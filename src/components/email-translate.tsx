/**
 * "Translate" panel for the reader's AI menu — translates the open email into a
 * chosen language on-device. Visibility is controlled by `ReaderAI`.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AiSheet } from '@/components/ai-sheet';
import { MarkdownText } from '@/components/markdown-text';
import { SteppedLoader } from '@/components/stepped-loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useEmailTranslate } from '@/hooks/use-email-translate';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Chinese', 'Japanese'];

export function EmailTranslate({
  bodyText,
  visible,
  onClose,
}: {
  bodyText: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { result, language, loading, error, translate, modelStatus } = useEmailTranslate({ bodyText });
  const ready = modelStatus === 'ready';
  const statusLabel = ready
    ? null
    : modelStatus === 'downloading'
      ? 'Downloading local AI…'
      : modelStatus === 'loading'
        ? 'Loading local AI…'
        : modelStatus === 'unsupported'
          ? 'Translation needs a physical device.'
          : modelStatus === 'error'
            ? 'Local AI failed to load.'
            : 'Starting local AI…';

  return (
    <AiSheet title="Translate" visible={visible} onClose={onClose}>
      {statusLabel ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {statusLabel}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Translate this email into:
          </ThemedText>
          <View style={styles.chips}>
            {LANGUAGES.map((lang) => {
              const active = language === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => void translate(lang)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive, loading && styles.chipDisabled]}
                >
                  <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                    {lang}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <SteppedLoader steps={[`Translating to ${language}`, 'Polishing the wording']} />
          ) : error ? (
            <ThemedText type="small" style={{ color: Colors.accentRed }}>
              {error}
            </ThemedText>
          ) : result ? (
            <ThemedView type="backgroundElement" style={styles.result}>
              <MarkdownText content={result} />
            </ThemedView>
          ) : null}
        </>
      )}
    </AiSheet>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.backgroundSelected,
    borderColor: Colors.backgroundSelected,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  result: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
