/**
 * On-device semantic search over the *loaded* inbox (Backlog: semantic search).
 *
 * Reuses the GTE-Large embeddings model already wired up for RAG (`embedText`):
 * embeds the query and each loaded message (subject + a slice of the body),
 * then ranks messages by cosine similarity so the most relevant float to the
 * top. Embeddings are cached per message id, so only newly-loaded mail is
 * embedded on a re-rank, and repeat searches are instant.
 *
 * Scope: this ranks the messages currently held in memory (what the user has
 * scrolled through), not the whole mailbox — embedding thousands of bodies
 * on-device isn't practical. Whole-mailbox keyword search stays the other mode.
 */
import { useEffect, useRef, useState } from 'react';

import { type EmbeddingStatus, useQvac } from '@/hooks/use-qvac';
import type { GmailMessage } from '@/lib/gmail';

// Query embeddings are cheap to recompute; message embeddings are cached so a
// growing inbox only embeds the new arrivals.
const embedCache = new Map<string, number[]>();

const DEBOUNCE_MS = 300;
// GTE-Large baseline similarity for unrelated English text is fairly high, so a
// low floor only drops clearly-irrelevant mail; ranking does the real work.
const MIN_SCORE = 0.2;
const MAX_RESULTS = 30;
const BODY_CHARS = 500;

function embeddingText(m: GmailMessage): string {
  const body = (m.bodyText || m.snippet || '').slice(0, BODY_CHARS);
  return `${m.subject}\n${body}`.trim();
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

type RankState = {
  /** Ranked subset, or null when there's no active query (show the normal list). */
  results: GmailMessage[] | null;
  status: 'idle' | 'indexing' | 'ranking' | 'ready' | 'unsupported';
  /** Messages embedded so far / still to embed — drives the indexing progress. */
  indexed: number;
  totalToIndex: number;
};

const IDLE: RankState = { results: null, status: 'idle', indexed: 0, totalToIndex: 0 };

export type SemanticSearch = RankState & {
  /** Embeddings model lifecycle (it downloads on first use). */
  modelStatus: EmbeddingStatus;
  modelProgress: number | null;
};

export function useSemanticSearch(messages: GmailMessage[], query: string): SemanticSearch {
  const { embedText, embeddingStatus, embeddingProgress } = useQvac();
  // Hold the latest embedText out of the deps so the effect doesn't re-run on
  // every provider re-render.
  const embedRef = useRef(embedText);
  useEffect(() => {
    embedRef.current = embedText;
  }, [embedText]);

  const [state, setState] = useState<RankState>(IDLE);
  const trimmed = query.trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trimmed) {
        if (!cancelled) setState(IDLE);
        return;
      }
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
      if (cancelled) return;

      if (!cancelled) setState((s) => ({ ...s, status: 'indexing' }));
      const qVec = await embedRef.current(trimmed);
      if (cancelled) return;
      if (!qVec) {
        // No embeddings model (web / simulator / load failed).
        if (!cancelled) setState({ ...IDLE, status: 'unsupported' });
        return;
      }

      // Embed any loaded messages we haven't seen yet, surfacing progress.
      const pending = messages.filter((m) => !embedCache.has(m.id) && embeddingText(m));
      if (!cancelled) setState((s) => ({ ...s, status: 'indexing', indexed: 0, totalToIndex: pending.length }));
      for (let i = 0; i < pending.length; i++) {
        if (cancelled) return;
        const vec = await embedRef.current(embeddingText(pending[i]));
        if (cancelled) return;
        if (vec) embedCache.set(pending[i].id, vec);
        if (!cancelled) setState((s) => ({ ...s, indexed: i + 1 }));
      }
      if (cancelled) return;

      if (!cancelled) setState((s) => ({ ...s, status: 'ranking' }));
      const ranked = messages
        .map((m) => {
          const vec = embedCache.get(m.id);
          return { m, score: vec ? cosine(qVec, vec) : -1 };
        })
        .filter((r) => r.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map((r) => r.m);
      if (!cancelled) setState((s) => ({ ...s, results: ranked, status: 'ready' }));
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, messages]);

  return { ...state, modelStatus: embeddingStatus, modelProgress: embeddingProgress };
}
