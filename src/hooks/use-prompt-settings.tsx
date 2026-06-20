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
  /** Instruction for "Write with AI" in the Send tab (used by `buildDraftPrompt`). */
  draft:
    'You are helping write an email. Write a clear, friendly, professional email ' +
    'body based on the instruction below. Reply with ONLY the email body text — ' +
    'no subject line, no preamble, no quotes, no markdown.',
  /** Instruction for the reply options in the reader (used by `useSmartReplies`). */
  reply:
    'You are helping reply to an email. Suggest 3 short, distinct reply options ' +
    'the recipient could send back. Each reply is 1-2 sentences, polite and ' +
    'natural, with no greeting or signature. Return each option on its own line, ' +
    'with no numbering, bullets, or quotation marks.',
  /** Instruction for the "summarize my unread" digest (used by `useUnreadDigest`). */
  digest:
    'You are summarizing the user’s unread inbox. Below are their unread emails. ' +
    'Write a concise digest that prioritizes what matters and flags anything ' +
    'needing a reply or action. Use short bullet points, mention the sender, and ' +
    'keep it skimmable. Reply with only the digest.',
  /** Instruction for extracting action items from an email (used by `useEmailActions`). */
  actions:
    'Extract the action items, tasks, deadlines and important dates from this ' +
    'email. Reply with a short bullet list using "- ". If there are none, reply ' +
    'with exactly: No action items.',
  /** Instruction for translating an email (used by `useEmailTranslate`). */
  translate:
    'Translate the email below into the target language. Preserve the meaning and ' +
    'tone, and reply with only the translation.',
  /** Instruction for adjusting a draft’s tone in the Send tab (used by tone chips). */
  tone:
    'Rewrite the email body below in the requested tone. Keep the meaning and any ' +
    'key details. Reply with ONLY the rewritten body — no preamble or quotes.',
} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;
export type Prompts = Record<PromptKey, string>;

export const PROMPT_LABELS: Record<PromptKey, { title: string; help: string }> = {
  summary: {
    title: 'Email summary',
    help: 'Instruction for the short summary shown on each inbox card. The email is added automatically.',
  },
  draft: {
    title: 'AI draft (Send)',
    help: 'Instruction for “Write with AI” in the Send tab. Your topic, recipient and subject are added automatically.',
  },
  reply: {
    title: 'Reply suggestions',
    help: 'Instruction for the reply options in the email reader. The email being replied to is added automatically.',
  },
  digest: {
    title: 'Unread digest',
    help: 'Instruction for the “Summarize unread” digest in the inbox. Your unread emails are added automatically.',
  },
  actions: {
    title: 'Action items',
    help: 'Instruction for “Action items” in the reader’s AI menu. The email is added automatically.',
  },
  translate: {
    title: 'Translate',
    help: 'Instruction for “Translate” in the reader’s AI menu. The target language and email are added automatically.',
  },
  tone: {
    title: 'Adjust tone',
    help: 'Instruction for the tone chips in the Send tab. The chosen tone and your draft are added automatically.',
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
              setPrompts((p) => {
                const next = { ...p };
                for (const key of Object.keys(DEFAULT_PROMPTS) as PromptKey[]) {
                  if (typeof saved[key] === 'string') next[key] = saved[key] as string;
                }
                return next;
              });
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
