/**
 * User-editable instruction prompts for the local LLM (see Settings).
 *
 * The summarizer prompts that live in `use-qvac.tsx` are the *instruction*
 * portion only — the email body is always appended by the code, so a malformed
 * custom prompt can change the wording but can never break body injection. Each
 * prompt can be reset to its default.
 *
 * Persisted as a small JSON file in the app's document directory via
 * expo-file-system (no AsyncStorage dependency).
 */
import * as FileSystem from 'expo-file-system/legacy';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { logError } from '@/lib/log';

export const DEFAULT_PROMPTS = {
  /** Short summary shown on each inbox card (used by `summarize`). */
  summary:
    'Summarize the following email in 2-4 sentences (about 40-60 words). ' +
    'Capture the key points, any action needed, and important details. ' +
    'Reply with only the summary, no preamble or quotes.',
} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;
export type Prompts = Record<PromptKey, string>;

export const PROMPT_LABELS: Record<PromptKey, { title: string; help: string }> = {
  summary: {
    title: 'Email summary',
    help: 'Instruction for the short summary shown on each inbox card.',
  },
};

const FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}prompt-settings.json`
  : null;

type PromptSettingsValue = {
  prompts: Prompts;
  /** True once the saved prompts (if any) have been loaded. */
  ready: boolean;
  isDefault: (key: PromptKey) => boolean;
  setPrompt: (key: PromptKey, value: string) => void;
  resetPrompt: (key: PromptKey) => void;
};

const PromptSettingsContext = createContext<PromptSettingsValue | null>(null);

export function PromptSettingsProvider({ children }: PropsWithChildren) {
  const [prompts, setPrompts] = useState<Prompts>({ ...DEFAULT_PROMPTS });
  const [ready, setReady] = useState(false);

  // Mirror of `prompts` so the event handlers compute the next value without a
  // stale closure (assigning a ref outside render is allowed).
  const promptsRef = useRef(prompts);
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load any previously saved prompts on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (FILE) {
          const info = await FileSystem.getInfoAsync(FILE);
          if (info.exists) {
            const saved = JSON.parse(await FileSystem.readAsStringAsync(FILE)) as Partial<Prompts>;
            if (!cancelled) {
              setPrompts((p) => ({
                summary: typeof saved.summary === 'string' ? saved.summary : p.summary,
              }));
            }
          }
        }
      } catch (e) {
        logError('prompts', e, '(load failed)');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Debounced write — typing in the Settings field shouldn't hit disk per key.
  const persist = (next: Prompts) => {
    if (!FILE) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      FileSystem.writeAsStringAsync(FILE, JSON.stringify(next)).catch((e) =>
        logError('prompts', e, '(save failed)'),
      );
    }, 400);
  };

  const apply = (next: Prompts) => {
    promptsRef.current = next;
    setPrompts(next);
    persist(next);
  };

  const value: PromptSettingsValue = {
    prompts,
    ready,
    isDefault: (key) => promptsRef.current[key].trim() === DEFAULT_PROMPTS[key],
    setPrompt: (key, val) => apply({ ...promptsRef.current, [key]: val }),
    resetPrompt: (key) => apply({ ...promptsRef.current, [key]: DEFAULT_PROMPTS[key] }),
  };

  return <PromptSettingsContext.Provider value={value}>{children}</PromptSettingsContext.Provider>;
}

export function usePromptSettings(): PromptSettingsValue {
  const ctx = useContext(PromptSettingsContext);
  if (!ctx) {
    throw new Error('usePromptSettings must be used within a PromptSettingsProvider');
  }
  return ctx;
}
