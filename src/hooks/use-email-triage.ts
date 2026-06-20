/**
 * Lazily classifies a single email into one triage category with the local
 * QVAC model (Backlog: auto-triage labels). Mirrors `useEmailSummary`:
 *
 * - runs only once the model is `ready`, and only for cards that mount;
 * - results (including "couldn't classify" → `null`) are cached per message id,
 *   so paging back never re-runs the model;
 * - jobs are paused while another screen (the reader) is focused, and a queued
 *   job is skipped via `shouldRun` if its card unmounts first.
 *
 * The classification runs through the same serialized completion queue as the
 * summaries, so it never overlaps other model work — it just queues behind it.
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useQvac } from '@/hooks/use-qvac';
import type { GmailMessage } from '@/lib/gmail';
import { logError } from '@/lib/log';

export type TriageCategory = 'priority' | 'newsletter' | 'receipt' | 'social';

const CATEGORIES: TriageCategory[] = ['priority', 'newsletter', 'receipt', 'social'];

// `null` = classified but didn't fit a category (cached so we don't retry).
// A missing key = not classified yet.
const triageCache = new Map<string, TriageCategory | null>();

/** The triage category for a message, if one was already determined. */
export function getCachedTriage(id: string): TriageCategory | null | undefined {
  return triageCache.get(id);
}

const INSTRUCTION =
  'Classify this email into exactly one category: Priority, Newsletter, Receipt, or Social.\n' +
  '- Priority: a real person writing to you, or anything needing your reply or action.\n' +
  '- Newsletter: marketing, promotions, digests, announcements, mailing lists.\n' +
  '- Receipt: orders, invoices, payments, shipping, bookings, confirmations.\n' +
  '- Social: notifications from social networks (likes, follows, comments, invites).\n' +
  'Reply with ONLY the single category word, nothing else.';

function buildPrompt(from: string, subject: string, text: string): string {
  const body = text.slice(0, 1200);
  return `${INSTRUCTION}\n\nFrom: ${from}\nSubject: ${subject}\n\n${body}`;
}

// Map the model's free-text answer to a known category (tolerant of extra words
// or synonyms the model might emit instead of the exact label).
function parseCategory(raw: string): TriageCategory | null {
  const t = raw.toLowerCase();
  for (const c of CATEGORIES) if (t.includes(c)) return c;
  if (/invoice|order|payment|purchase|shipp|booking|confirm/.test(t)) return 'receipt';
  if (/promo|sale|offer|discount|deal|digest|market/.test(t)) return 'newsletter';
  if (/facebook|twitter|linkedin|instagram|follow|friend|mention/.test(t)) return 'social';
  if (/urgent|important|priorit|action|reply/.test(t)) return 'priority';
  return null;
}

export function useEmailTriage(
  message: Pick<GmailMessage, 'id' | 'from' | 'subject' | 'bodyText' | 'snippet'>,
) {
  const { status, complete } = useQvac();
  const isFocused = useIsFocused();
  // Hold the latest `complete` without putting it in the effect deps, so the
  // effect doesn't re-run (and re-queue) on every provider re-render.
  const completeRef = useRef(complete);
  useEffect(() => {
    completeRef.current = complete;
  }, [complete]);

  const [category, setCategory] = useState<TriageCategory | null>(
    () => triageCache.get(message.id) ?? null,
  );

  const { id, from, subject, bodyText, snippet } = message;
  useEffect(() => {
    if (status !== 'ready' || !isFocused) return;
    const text = bodyText || snippet;
    if (!text) return;
    let cancelled = false;
    (async () => {
      if (triageCache.has(id)) {
        if (!cancelled) setCategory(triageCache.get(id) ?? null);
        return;
      }
      try {
        const result = await completeRef.current(buildPrompt(from, subject, text), () => !cancelled, 'triage');
        // null = model not ready or job skipped; don't cache, allow a later retry.
        if (result == null) return;
        const cat = parseCategory(result);
        triageCache.set(id, cat);
        if (!cancelled) setCategory(cat);
      } catch (e) {
        logError('triage', e, id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, isFocused, id, from, subject, bodyText, snippet]);

  return category;
}
