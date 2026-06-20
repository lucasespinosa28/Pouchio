/**
 * One-tap "summarize my unread" digest (Backlog/AI extras). Synthesizes a single
 * digest from the loaded unread emails with the local LLM.
 *
 * Reuses the per-card summaries already generated for the inbox (`getCachedSummary`)
 * when present, falling back to the Gmail snippet — so the digest is one extra
 * completion, not one-per-email. Scoped to the unread messages currently loaded.
 */
import { useState } from 'react';

import { getCachedSummary } from '@/hooks/use-email-summary';
import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useQvac } from '@/hooks/use-qvac';
import { senderName } from '@/components/message-card';
import type { GmailMessage } from '@/lib/gmail';
import { logError } from '@/lib/log';

const MAX_EMAILS = 15;

function buildDigestPrompt(instruction: string, items: string): string {
  return `${instruction}\n\nUnread emails:\n${items}\n\nDigest:`;
}

export function useUnreadDigest(messages: GmailMessage[]) {
  const { status, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unread = messages.filter((m) => m.unread);

  // Called from a press handler, so setState here is fine.
  const generate = async () => {
    if (status !== 'ready' || loading || unread.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const items = unread
        .slice(0, MAX_EMAILS)
        .map((m, i) => {
          const gist = getCachedSummary(m.id) || m.snippet || '';
          return `${i + 1}. From ${senderName(m.from)} — ${m.subject}\n${gist}`.trim();
        })
        .join('\n\n');
      const out = await complete(buildDigestPrompt(prompts.digest, items), undefined, 'digest');
      if (!out) {
        setError('Could not build a digest. Try again.');
        return;
      }
      setDigest(out);
    } catch (e) {
      logError('digest', e);
      setError('Could not build a digest. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return { digest, loading, error, generate, count: unread.length, modelStatus: status };
}
