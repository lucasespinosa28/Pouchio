/**
 * Translates the open email into a chosen language with the local LLM
 * (AI extras). Triggered when the user picks a target language.
 */
import { useState } from 'react';

import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useQvac } from '@/hooks/use-qvac';
import { logError } from '@/lib/log';

const BODY_CHARS = 2000;

export function useEmailTranslate(input: { bodyText?: string }) {
  const { status, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [result, setResult] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called from a press handler, so setState here is fine.
  const translate = async (lang: string) => {
    const body = input.bodyText;
    if (status !== 'ready' || !body || loading) return;
    setLanguage(lang);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const prompt =
        `${prompts.translate}\n\nTarget language: ${lang}\n\n` +
        `Email:\n${body.slice(0, BODY_CHARS)}\n\nTranslation:`;
      const out = await complete(prompt, undefined, 'translate');
      if (!out) {
        setError('Could not translate. Try again.');
        return;
      }
      setResult(out);
    } catch (e) {
      logError('translate', e);
      setError('Could not translate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return { result, language, loading, error, translate, modelStatus: status };
}
