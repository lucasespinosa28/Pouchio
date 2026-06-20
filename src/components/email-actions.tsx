/**
 * "Action items" panel for the reader's AI menu — extracts tasks/dates from the
 * open email on-device. Visibility is controlled by `ReaderAI`.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AiSheet } from '@/components/ai-sheet';
import { MarkdownText } from '@/components/markdown-text';
import { SteppedLoader } from '@/components/stepped-loader';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useEmailActions } from '@/hooks/use-email-actions';

export function EmailActions({
  subject,
  bodyText,
  visible,
  onClose,
}: {
  subject: string;
  bodyText: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { result, loading, error, generate, modelStatus } = useEmailActions({ subject, bodyText });
  const ready = modelStatus === 'ready';
  const statusLabel = ready
    ? null
    : modelStatus === 'downloading'
      ? 'Downloading local AI…'
      : modelStatus === 'loading'
        ? 'Loading local AI…'
        : modelStatus === 'unsupported'
          ? 'Action items need a physical device.'
          : modelStatus === 'error'
            ? 'Local AI failed to load.'
            : 'Starting local AI…';

  // Extract on open. Deferred so the first setState isn't synchronous here.
  useEffect(() => {
    if (!visible || !ready || result || loading) return;
    const t = setTimeout(() => void generate(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  return (
    <AiSheet title="Action items" visible={visible} onClose={onClose}>
      {statusLabel ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {statusLabel}
        </ThemedText>
      ) : loading ? (
        <SteppedLoader steps={['Reading the email', 'Finding tasks & dates', 'Writing the list']} />
      ) : error ? (
        <View style={styles.col}>
          <ThemedText type="small" style={{ color: Colors.accentRed }}>
            {error}
          </ThemedText>
          <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
              Try again
            </ThemedText>
          </Pressable>
        </View>
      ) : result ? (
        <>
          <MarkdownText content={result} />
          <Pressable onPress={() => void generate()} style={styles.regen} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
              ↻ Regenerate
            </ThemedText>
          </Pressable>
        </>
      ) : null}
    </AiSheet>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  col: {
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
