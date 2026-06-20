/**
 * Extracts action items / dates from the open email with the local LLM
 * (AI extras). On-demand (a tap), like the reply suggestions.
 */
import { useState } from 'react';

import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useQvac } from '@/hooks/use-qvac';
import { logError } from '@/lib/log';

const BODY_CHARS = 2000;

export function useEmailActions(input: { subject?: string; bodyText?: string }) {
  const { status, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called from a press handler, so setState here is fine.
  const generate = async () => {
    const body = input.bodyText;
    if (status !== 'ready' || !body || loading) return;
    setLoading(true);
    setError(null);
    try {
      const subj = input.subject?.trim() ? `Subject: ${input.subject.trim()}\n` : '';
      const prompt = `${prompts.actions}\n\n${subj}Email:\n${body.slice(0, BODY_CHARS)}\n\nAction items:`;
      const out = await complete(prompt, undefined, 'actions');
      if (!out) {
        setError('Could not extract action items. Try again.');
        return;
      }
      setResult(out);
    } catch (e) {
      logError('actions', e);
      setError('Could not extract action items. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate, modelStatus: status };
}
