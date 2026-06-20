/**
 * RAG chat over a single email (TODO #13), following docs/rag.md.
 *
 * On first use it chunks the email body and embeds each chunk with the local
 * embeddings model (cached per email id). For each question it embeds the query,
 * ranks chunks by cosine similarity, and feeds the top‑K chunks as context to
 * the LLM `completion()` so the answer is grounded in the email.
 */
import { useCallback, useRef, useState } from 'react';

import { useQvac } from '@/hooks/use-qvac';
import { logError } from '@/lib/log';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const TOP_K = 6;
// Emails up to this size are passed whole (they fit the context window), which
// grounds answers better than retrieving a subset. Larger emails use RAG.
const WHOLE_BODY_LIMIT = 3000;

// Embedded chunks per email id, so re-opening the chat doesn't re-embed.
type Indexed = { chunks: string[]; vectors: number[][] };
const indexCache = new Map<string, Indexed>();

// Split text into overlapping chunks on whitespace boundaries.
function chunkText(text: string): string[] {
  const clean = text.trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const ws = clean.lastIndexOf(' ', end);
      if (ws > start + CHUNK_SIZE / 2) end = ws;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useEmailChat(emailId: string | undefined, bodyText: string | undefined) {
  const { embeddingStatus, embeddingProgress, embedText, complete } = useQvac();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const inFlight = useRef(false);

  // Build (or reuse) the per-email chunk embeddings.
  const ensureIndex = useCallback(async (): Promise<Indexed | null> => {
    if (!emailId || !bodyText) return null;
    const cached = indexCache.get(emailId);
    if (cached) return cached;
    const chunks = chunkText(bodyText);
    if (chunks.length === 0) return null;
    const vectors: number[][] = [];
    for (const chunk of chunks) {
      const v = await embedText(chunk);
      if (!v) return null; // embedding model unavailable — bail out
      vectors.push(v);
    }
    const indexed: Indexed = { chunks, vectors };
    indexCache.set(emailId, indexed);
    return indexed;
  }, [emailId, bodyText, embedText]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || inFlight.current) return;
      inFlight.current = true;
      setAsking(true);
      const userMsg: ChatMessage = { id: makeId(), role: 'user', text: q };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const body = (bodyText ?? '').trim();
        let context = '';
        if (body && body.length <= WHOLE_BODY_LIMIT) {
          // Short enough to fit the context window — use the whole email.
          context = body;
        } else if (body) {
          // Long email: retrieve the most relevant chunks via embeddings.
          const index = await ensureIndex();
          if (index) {
            const qv = await embedText(q);
            const ranked = qv
              ? index.chunks
                  .map((chunk, i) => ({ chunk, score: cosine(qv, index.vectors[i]) }))
                  .sort((a, b) => b.score - a.score)
                  .slice(0, TOP_K)
                  .map((r) => r.chunk)
              : index.chunks.slice(0, TOP_K);
            context = ranked.join('\n\n');
          } else {
            context = body.slice(0, WHOLE_BODY_LIMIT);
          }
        }
        if (!context) {
          setMessages((prev) => [
            ...prev,
            { id: makeId(), role: 'assistant', text: "This email doesn't have any readable text." },
          ]);
          return;
        }
        const prompt =
          'You are answering a question about an email. Use ONLY the email content ' +
          'below to answer. If the answer is not in the email, say you could not find ' +
          `it.\n\nEMAIL:\n"""\n${context}\n"""\n\nQUESTION: ${q}\n\nANSWER:`;
        const answer = (await complete(prompt)) ?? 'Sorry, I could not generate an answer.';
        setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: answer }]);
      } catch (e) {
        logError('chat', e, emailId);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', text: 'Something went wrong answering that.' },
        ]);
      } finally {
        inFlight.current = false;
        setAsking(false);
      }
    },
    [ensureIndex, embedText, complete, bodyText, emailId],
  );

  return { messages, asking, ask, embeddingStatus, embeddingProgress };
}
