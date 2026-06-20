/**
 * "✨ Summarize unread" pill for the inbox + the digest sheet it opens
 * (AI extras). Synthesizes the loaded unread emails into one on-device digest.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkdownText } from '@/components/markdown-text';
import { SteppedLoader } from '@/components/stepped-loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useUnreadDigest } from '@/hooks/use-unread-digest';
import type { GmailMessage } from '@/lib/gmail';

export function UnreadDigest({ messages }: { messages: GmailMessage[] }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { digest, loading, error, generate, count, modelStatus } = useUnreadDigest(messages);

  // Nothing to digest, or the local model can't run here.
  if (count === 0 || modelStatus === 'unsupported') return null;

  const ready = modelStatus === 'ready';
  const statusLabel =
    modelStatus === 'downloading'
      ? 'Downloading local AI…'
      : modelStatus === 'loading'
        ? 'Loading local AI…'
        : modelStatus === 'error'
          ? 'Local AI failed to load.'
          : !ready
            ? 'Starting local AI…'
            : null;

  const openSheet = () => {
    setOpen(true);
    if (ready && !digest && !loading) void generate();
  };

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`Summarize ${count} unread emails`}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <ThemedText type="smallBold" style={styles.pillText}>
          ✨ Summarize {count} unread
        </ThemedText>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ThemedView style={styles.sheet}>
          <View style={[styles.sheetHeader, { paddingTop: insets.top + Spacing.two }]}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              Unread digest
            </ThemedText>
            <Pressable onPress={() => setOpen(false)} hitSlop={Spacing.two} accessibilityLabel="Close">
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
              <SteppedLoader
                steps={[
                  `Reading ${count} unread email${count === 1 ? '' : 's'}`,
                  'Summarizing with on-device AI',
                  'Polishing your digest',
                ]}
              />
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
            ) : digest ? (
              <>
                <MarkdownText content={digest} />
                <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
                    ↻ Regenerate
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSelected,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    color: Colors.primaryShadow,
  },
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
    gap: Spacing.three,
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
  regen: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
