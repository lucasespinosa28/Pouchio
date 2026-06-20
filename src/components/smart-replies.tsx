/**
 * "✨ Reply" floating button + sheet for the email reader (Backlog: smart
 * replies). The local model drafts a few short reply options; tapping one opens
 * the Send tab prefilled with the recipient, a `Re:` subject, and the chosen
 * reply above a quote of the original — so the user can edit before sending.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { senderEmail, senderName } from '@/components/message-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useSmartReplies } from '@/hooks/use-smart-replies';
import type { GmailMessageContent } from '@/lib/gmail';

const QUOTE_CHARS = 1000;

function replySubject(subject: string): string {
  const s = subject.trim();
  if (!s) return 'Re:';
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

// Compose the prefilled reply: the chosen text, then the quoted original.
function buildReplyBody(reply: string, content: GmailMessageContent): string {
  const quoted = content.bodyText
    .slice(0, QUOTE_CHARS)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const when = (() => {
    const d = new Date(content.date);
    return Number.isNaN(d.getTime()) ? content.date : d.toLocaleString();
  })();
  return `${reply}\n\nOn ${when}, ${senderName(content.from)} wrote:\n${quoted}`;
}

export function SmartReplies({
  content,
  visible,
  onClose,
}: {
  content: GmailMessageContent;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Monotonic token so each reply prefill is distinct (drives Send's re-apply).
  const prefillSeq = useRef(0);
  const { suggestions, loading, error, generate, modelStatus } = useSmartReplies({
    from: content.from,
    subject: content.subject,
    bodyText: content.bodyText,
  });

  const ready = modelStatus === 'ready';
  const statusLabel = ready
    ? null
    : modelStatus === 'downloading'
      ? 'Downloading local AI…'
      : modelStatus === 'loading'
        ? 'Loading local AI…'
        : modelStatus === 'unsupported'
          ? 'Smart replies need a physical device.'
          : modelStatus === 'error'
            ? 'Local AI failed to load.'
            : 'Starting local AI…';

  // Draft on open so suggestions are ready (or cached) by the time the sheet
  // animates in. Deferred so the first setState isn't synchronous in the effect.
  useEffect(() => {
    if (!visible || !ready || suggestions || loading) return;
    const t = setTimeout(() => void generate(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  const applyReply = (text: string) => {
    onClose();
    router.push({
      pathname: '/send',
      params: {
        to: senderEmail(content.from),
        subject: replySubject(content.subject),
        body: buildReplyBody(text, content),
        // Unique token so Send re-applies the prefill on each reply.
        prefill: String((prefillSeq.current += 1)),
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <ThemedView style={styles.sheet}>
          <View style={[styles.sheetHeader, { paddingTop: insets.top + Spacing.two }]}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              Reply suggestions
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={Spacing.two} accessibilityLabel="Close">
              <ThemedText type="smallBold" themeColor="textSecondary">
                Close
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.four }]}>
            {statusLabel ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                {statusLabel}
              </ThemedText>
            ) : loading ? (
              <View style={styles.loading}>
                <ActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  Drafting replies…
                </ThemedText>
              </View>
            ) : error ? (
              <View style={styles.loading}>
                <ThemedText type="small" style={{ color: Colors.accentRed }}>
                  {error}
                </ThemedText>
                <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
                    Try again
                  </ThemedText>
                </Pressable>
              </View>
            ) : suggestions ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  Tap a reply to edit and send it.
                </ThemedText>
                {suggestions.map((text, i) => (
                  <Pressable
                    key={i}
                    onPress={() => applyReply(text)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                  >
                    <ThemedText type="small">{text}</ThemedText>
                    <ThemedText type="smallBold" style={[styles.editHint, { color: Colors.secondary }]}>
                      Edit &amp; send →
                    </ThemedText>
                  </Pressable>
                ))}
                <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
                    ↻ Regenerate
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
                  Suggest replies
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sheetTitle: {
    fontSize: 20,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  hint: {
    paddingHorizontal: Spacing.half,
    paddingBottom: Spacing.one,
  },
  suggestion: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  suggestionPressed: {
    backgroundColor: Colors.backgroundElement,
  },
  editHint: {
    alignSelf: 'flex-end',
  },
  regen: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
