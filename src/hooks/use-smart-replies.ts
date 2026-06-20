/**
 * Generates a few short reply suggestions for the open email with the local LLM
 * (Backlog: smart replies in the reader). Triggered on demand (a tap), not
 * automatically — drafting three replies is heavier than a summary and we don't
 * want it running for every email the user merely opens.
 *
 * The model is asked for one reply per line; `parseReplies` is tolerant of the
 * bullets/numbering/quotes models tend to add anyway.
 */
import { useState } from 'react';

import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useQvac } from '@/hooks/use-qvac';
import { logError } from '@/lib/log';

const MAX_REPLIES = 3;
const BODY_CHARS = 1500;

// The `instruction` is user-editable in Settings; the email context is always
// appended here so a custom instruction can't break body injection.
function buildPrompt(instruction: string, from: string, subject: string, body: string): string {
  const ctx: string[] = [];
  if (from.trim()) ctx.push(`Email from: ${from.trim()}`);
  if (subject.trim()) ctx.push(`Subject: ${subject.trim()}`);
  return (
    instruction +
    (ctx.length ? `\n\n${ctx.join('\n')}` : '') +
    `\n\nEmail:\n${body.slice(0, BODY_CHARS)}\n\nReply options:`
  );
}

// Split the model output into clean one-line replies, stripping any leading
// bullet/number/quote the model may have added.
function parseReplies(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_REPLIES);
}

export function useSmartReplies(input: {
  from?: string;
  subject?: string;
  bodyText?: string;
}) {
  const { status, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called from a press handler (not an effect), so setState here is fine.
  const generate = async () => {
    const body = input.bodyText;
    if (status !== 'ready' || !body || loading) return;
    setLoading(true);
    setError(null);
    try {
      const out = await complete(buildPrompt(prompts.reply, input.from ?? '', input.subject ?? '', body), undefined, 'reply');
      if (!out) {
        setError('Could not draft replies. Try again.');
        return;
      }
      const parsed = parseReplies(out);
      setSuggestions(parsed.length ? parsed : [out.trim()]);
    } catch (e) {
      logError('smart-replies', e);
      setError('Could not draft replies. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return { suggestions, loading, error, generate, modelStatus: status };
}
