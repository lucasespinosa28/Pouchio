import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignIn } from '@/components/google-sign-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { usePromptSettings } from '@/hooks/use-prompt-settings';
import { useQvac } from '@/hooks/use-qvac';
import { useTheme } from '@/hooks/use-theme';
import { GmailError, sendEmail } from '@/lib/gmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'off';
};

function ComposeField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: Field) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.inputWrap, multiline && styles.inputWrapMulti]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, multiline && styles.inputMulti]}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={!multiline ? false : undefined}
          autoComplete={autoComplete}
          textContentType={autoComplete === 'email' ? 'emailAddress' : undefined}
        />
      </ThemedView>
    </View>
  );
}

// Prompt the local LLM to draft an email body from a short instruction. The
// `instruction` is user-editable in Settings; the topic/recipient/subject are
// always appended here so a custom instruction can't break that context.
function buildDraftPrompt(instruction: string, topic: string, to: string, subject: string): string {
  const ctx: string[] = [];
  if (to.trim()) ctx.push(`Recipient: ${to.trim()}`);
  if (subject.trim()) ctx.push(`Subject: ${subject.trim()}`);
  return (
    instruction +
    (ctx.length ? `\n\n${ctx.join('\n')}` : '') +
    `\n\nInstruction: ${topic.trim()}\n\nEmail body:`
  );
}

// Inline "write with AI" helper that drafts the message body on-device.
function AiAssist({
  to,
  subject,
  onDraft,
}: {
  to: string;
  subject: string;
  onDraft: (body: string) => void;
}) {
  const theme = useTheme();
  const { status, progress, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [topic, setTopic] = useState('');
  const [drafting, setDrafting] = useState(false);

  const ready = status === 'ready';
  const aiLabel =
    status === 'ready'
      ? null
      : status === 'downloading'
        ? `Downloading local AI… ${progress ?? 0}%`
        : status === 'loading'
          ? `Loading local AI… ${progress ?? 0}%`
          : status === 'unsupported'
            ? 'AI drafting needs a physical device.'
            : status === 'error'
              ? 'Local AI failed to load.'
              : 'Starting local AI…';

  const canDraft = ready && topic.trim().length > 0 && !drafting;

  const draft = async () => {
    if (!canDraft) return;
    setDrafting(true);
    try {
      const body = await complete(buildDraftPrompt(prompts.draft, topic, to, subject), undefined, 'draft');
      if (body) onDraft(body);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.aiCard}>
      <ThemedText type="smallBold">✨ Write with AI</ThemedText>
      <TextInput
        value={topic}
        onChangeText={setTopic}
        placeholder="Describe the email — e.g. “ask Sam to reschedule Friday’s call”"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, styles.aiInput, { color: theme.text }]}
        multiline
        editable={ready && !drafting}
      />
      {aiLabel ? (
        <ThemedText type="small" themeColor="textSecondary">
          {aiLabel}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Draft email with AI"
        disabled={!canDraft}
        onPress={draft}
        style={[styles.aiButton, !canDraft && styles.disabled]}
      >
        {drafting ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <ThemedText style={styles.aiButtonText}>Draft for me</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const TONES = ['Formal', 'Casual', 'Shorter'];

function buildTonePrompt(instruction: string, tone: string, body: string): string {
  return `${instruction}\n\nTone: ${tone}\n\nEmail body:\n${body}\n\nRewritten:`;
}

// Rewrites the current draft body in a chosen tone, on-device.
function ToneChips({ body, onRewrite }: { body: string; onRewrite: (b: string) => void }) {
  const { status, complete } = useQvac();
  const { prompts } = usePromptSettings();
  const [busy, setBusy] = useState<string | null>(null);

  if (status !== 'ready' || !body.trim()) return null;

  const apply = async (tone: string) => {
    if (busy) return;
    setBusy(tone);
    try {
      const out = await complete(buildTonePrompt(prompts.tone, tone, body), undefined, 'tone');
      if (out) onRewrite(out);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.toneRow}>
      <ThemedText type="small" themeColor="textSecondary">
        ✨ Adjust tone:
      </ThemedText>
      {TONES.map((tone) => (
        <Pressable
          key={tone}
          onPress={() => apply(tone)}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel={`Rewrite ${tone.toLowerCase()}`}
          style={[styles.toneChip, !!busy && styles.disabled]}
        >
          {busy === tone ? (
            <ActivityIndicator size="small" />
          ) : (
            <ThemedText type="smallBold" themeColor="textSecondary">
              {tone}
            </ThemedText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, getAccessToken } = useGoogleAuth();
  // Prefill params arrive from "Reply" in the email reader.
  const params = useLocalSearchParams<{
    to?: string;
    subject?: string;
    body?: string;
    prefill?: string;
  }>();

  const [to, setTo] = useState(params.to ?? '');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Apply a reply prefill when one arrives. Keyed by the `prefill` token so a
  // new reply repopulates the form, but ordinary re-renders never clobber edits.
  const appliedPrefill = useRef<string | null>(null);
  useEffect(() => {
    const token = params.prefill;
    if (!token || appliedPrefill.current === token) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      appliedPrefill.current = token;
      if (typeof params.to === 'string') setTo(params.to);
      if (typeof params.subject === 'string') setSubject(params.subject);
      if (typeof params.body === 'string') setBody(params.body);
      setStatus(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.prefill, params.to, params.subject, params.body]);

  const topInset = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;
  const bottomInset = insets.bottom + BottomTabInset + Spacing.three;

  const recipientValid = EMAIL_RE.test(to.trim());
  const canSend = recipientValid && body.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setStatus(null);
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus({ kind: 'error', text: 'Could not get a Google token. Sign in again.' });
        return;
      }
      await sendEmail(token, { to: to.trim(), subject: subject.trim(), body });
      setTo('');
      setSubject('');
      setBody('');
      setStatus({ kind: 'ok', text: 'Email sent ✓' });
    } catch (e) {
      const text =
        e instanceof GmailError
          ? e.message
          : 'Could not send the email. Check your connection and try again.';
      setStatus({ kind: 'error', text });
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: topInset }]}>
        <ThemedText type="subtitle" style={styles.title}>
          Send
        </ThemedText>

        {isAuthenticated ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Spacing.two}
          >
            <ScrollView
              contentContainerStyle={[styles.form, { paddingBottom: bottomInset }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <ComposeField
                label="To"
                value={to}
                onChangeText={setTo}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <ComposeField
                label="Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject"
                autoCapitalize="sentences"
                autoComplete="off"
              />

              <AiAssist to={to} subject={subject} onDraft={setBody} />

              <ComposeField
                label="Message"
                value={body}
                onChangeText={setBody}
                placeholder="Write your message…"
                multiline
                autoCapitalize="sentences"
                autoComplete="off"
              />

              <ToneChips body={body} onRewrite={setBody} />

              {to.length > 0 && !recipientValid ? (
                <ThemedText type="small" style={[styles.note, { color: Colors.accentRed }]}>
                  Enter a valid email address.
                </ThemedText>
              ) : null}

              {status ? (
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.note,
                    { color: status.kind === 'ok' ? Colors.primary : Colors.accentRed },
                  ]}
                >
                  {status.text}
                </ThemedText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send email"
                disabled={!canSend}
                onPress={send}
                style={({ pressed }) => [
                  styles.sendButton,
                  !canSend && styles.disabled,
                  pressed && canSend && styles.sendPressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <ThemedText style={styles.sendText}>Send</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.signedOut}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.prompt}>
              Sign in with Google to send email.
            </ThemedText>
            <GoogleSignIn />
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  title: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  form: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  inputWrap: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputWrapMulti: {
    minHeight: 200,
  },
  input: {
    fontSize: 16,
    minHeight: 28,
  },
  inputMulti: {
    minHeight: 180,
    textAlignVertical: 'top',
  },
  aiCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.backgroundSelected,
  },
  aiInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  aiButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Spacing.three,
    borderBottomWidth: 4,
    borderBottomColor: Colors.primaryShadow,
  },
  aiButtonText: {
    color: Colors.onPrimary,
    fontWeight: '800',
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: -Spacing.one,
  },
  toneChip: {
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundElement,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  note: {
    paddingHorizontal: Spacing.half,
  },
  sendButton: {
    marginTop: Spacing.two,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Spacing.three,
    // Duolingo 3D button: thick bottom edge in the shadow green.
    borderBottomWidth: 4,
    borderBottomColor: Colors.primaryShadow,
  },
  sendPressed: {
    // Press the button "down" into its shadow edge.
    borderBottomWidth: 0,
    marginTop: Spacing.two + 4,
  },
  disabled: {
    opacity: 0.5,
  },
  sendText: {
    color: Colors.onPrimary,
    fontWeight: '800',
    fontSize: 17,
  },
  signedOut: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  prompt: {
    textAlign: 'center',
  },
});
