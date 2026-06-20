import Constants from 'expo-constants';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignIn } from '@/components/google-sign-in';
import { QvacStatus } from '@/components/qvac-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { PROMPT_LABELS, type PromptKey, usePromptSettings } from '@/hooks/use-prompt-settings';
import { useTheme } from '@/hooks/use-theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

// Editable instruction prompt with a "reset to default" affordance.
function PromptField({ promptKey }: { promptKey: PromptKey }) {
  const theme = useTheme();
  const { prompts, setPrompt, resetPrompt, isDefault } = usePromptSettings();
  const meta = PROMPT_LABELS[promptKey];
  const modified = !isDefault(promptKey);

  return (
    <View style={styles.promptField}>
      <View style={styles.promptHeader}>
        <ThemedText type="smallBold">{meta.title}</ThemedText>
        {modified ? (
          <Pressable
            onPress={() => resetPrompt(promptKey)}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityLabel={`Reset ${meta.title} prompt to default`}
          >
            <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
              Reset to default
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedView type="backgroundElement" style={styles.promptInputWrap}>
        <TextInput
          value={prompts[promptKey]}
          onChangeText={(t) => setPrompt(promptKey, t)}
          placeholder={meta.help}
          placeholderTextColor={theme.textSecondary}
          style={[styles.promptInput, { color: theme.text }]}
          multiline
        />
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {meta.help} The email is always added automatically.
      </ThemedText>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;
  const bottomInset = insets.bottom + BottomTabInset + Spacing.three;

  const appName = Constants.expoConfig?.name ?? 'Pouchio';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: topInset }]}>
        <ThemedText type="subtitle" style={styles.title}>
          Settings
        </ThemedText>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="Account">
            <GoogleSignIn />
          </Section>

          <Section title="Local AI">
            <QvacStatus />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Summaries, drafting and Ask&nbsp;AI run on-device with a local model —
              your email content never leaves your phone.
            </ThemedText>
          </Section>

          <Section title="AI prompts">
            <PromptField promptKey="summary" />
          </Section>

          <Section title="About">
            <ThemedView type="backgroundElement" style={styles.infoCard}>
              <InfoRow label="App" value={appName} />
              <InfoRow label="Version" value={version} />
            </ThemedView>
          </Section>
        </ScrollView>
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
  title: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  body: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.half,
    letterSpacing: 0.5,
  },
  hint: {
    paddingHorizontal: Spacing.half,
  },
  promptField: {
    gap: Spacing.one,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  promptInputWrap: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  promptInput: {
    fontSize: 15,
    lineHeight: 21,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  infoCard: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
