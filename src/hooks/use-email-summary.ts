/**
 * Lazily summarizes a single email's body with the local QVAC model (TODO #8).
 *
 * Runs only once the model is `ready`, and only for cards that mount (FlatList
 * windowing keeps that to what's on screen). Results are cached per message id,
 * so paging back to a message never re-summarizes it.
 *
 * When a card unmounts (page change / scroll-off) before its queued job runs,
 * the job is skipped via the `shouldRun` predicate so visible cards aren't stuck
 * waiting behind summaries no one is looking at anymore.
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useQvac } from '@/hooks/use-qvac';
import type { GmailMessage } from '@/lib/gmail';
import { logError } from '@/lib/log';

const summaryCache = new Map<string, string>();

/** The short list summary for a message, if one was already generated. */
export function getCachedSummary(id: string): string | undefined {
  return summaryCache.get(id);
}

export function useEmailSummary(message: Pick<GmailMessage, 'id' | 'bodyText'>) {
  const { status, summarize } = useQvac();
  // Pause inbox summaries while another screen (the email reader) is on top, so
  // its detailed summary isn't stuck behind off-screen list work. Resumes on
  // return to the inbox.
  const isFocused = useIsFocused();
  // Hold the latest summarize without putting it in the effect deps — otherwise
  // the effect would re-run (and re-queue) every time the provider re-renders.
  const summarizeRef = useRef(summarize);
  useEffect(() => {
    summarizeRef.current = summarize;
  }, [summarize]);

  const [summary, setSummary] = useState<string | null>(() => summaryCache.get(message.id) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || !message.bodyText || !isFocused) return;
    let cancelled = false;
    (async () => {
      const cached = summaryCache.get(message.id);
      if (cached) {
        if (!cancelled) setSummary(cached);
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const result = await summarizeRef.current(message.bodyText, () => !cancelled);
        if (result) {
          summaryCache.set(message.id, result);
          if (!cancelled) setSummary(result);
        }
      } catch (e) {
        logError('summary', e, message.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, message.id, message.bodyText, isFocused]);

  return { summary, loading };
}
