import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignIn } from '@/components/google-sign-in';
import { QvacStatus } from '@/components/qvac-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { PROMPT_LABELS, type PromptKey, usePromptSettings } from '@/hooks/use-prompt-settings';
import { useTheme } from '@/hooks/use-theme';
import { clearLogs, exportLogs, getEntries, type LogEntry } from '@/lib/log';
import { clear as clearPerf, exportCsv, exportJson, summary } from '@/lib/perf';

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
        {meta.help}
      </ThemedText>
    </View>
  );
}

function levelColor(level: LogEntry['level']): string {
  return level === 'error' ? Colors.accentRed : level === 'warn' ? Colors.accentOrange : Colors.secondary;
}

// On-device log viewer + share-to-file. Shows the app's own logs (qvac / gmail /
// auth / perf) captured in memory as a table, plus the run's perf summary.
function PerfExport() {
  const [rows, setRows] = useState<LogEntry[]>(() => getEntries());
  const [status, setStatus] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const stats = summary();

  // Live-tail the in-memory log while the panel is open so AI lines
  // ([qvac]/[perf]) show up as inference runs, without manual refreshes.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setRows(getEntries()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const refresh = () => {
    setRows(getEntries());
    setStatus(null);
  };

  const shareFile = async (
    make: () => Promise<string | null>,
    mimeType: string,
    uti: string,
    name: string,
  ) => {
    setStatus('Preparing…');
    const path = await make();
    if (!path) {
      setStatus('Export not available on this platform.');
      return;
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType, UTI: uti, dialogTitle: `Share ${name}` });
        setStatus(`Shared ${name}.`);
      } else {
        setStatus(`Saved:\n${path}`);
      }
    } catch {
      setStatus('Sharing dismissed.');
    }
  };

  const onClear = () => {
    clearLogs();
    clearPerf();
    setRows([]);
    setStatus('Log cleared.');
  };

  const ttft = stats.avgTtftMs != null ? `${Math.round(stats.avgTtftMs)} ms` : '—';
  const tps = stats.avgTokensPerSec != null ? `${stats.avgTokensPerSec.toFixed(1)} tok/s` : '—';

  return (
    <ThemedView type="backgroundElement" style={styles.perfCard}>
      <View style={styles.perfStats}>
        <ThemedText type="smallBold">
          {rows.length} log lines · {stats.completions} inferences
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          avg TTFT {ttft} · {tps}
        </ThemedText>
      </View>

      <View style={styles.logTable}>
        <View style={[styles.logRow, styles.logHeaderRow]}>
          <ThemedText style={[styles.logHeaderCell, styles.cellTime]}>TIME</ThemedText>
          <ThemedText style={[styles.logHeaderCell, styles.cellTag]}>TAG</ThemedText>
          <ThemedText style={[styles.logHeaderCell, styles.cellMsg]}>MESSAGE</ThemedText>
        </View>
        <ScrollView style={styles.logBody} nestedScrollEnabled>
          {rows.length ? (
            rows.map((e, i) => (
              <View key={i} style={[styles.logRow, i % 2 === 1 && styles.logRowAlt]}>
                <ThemedText style={[styles.logCell, styles.cellTime]}>
                  {new Date(e.ts).toISOString().slice(11, 19)}
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={[styles.logCell, styles.cellTag, styles.logTag, { color: levelColor(e.level) }]}
                >
                  {e.scope}
                </ThemedText>
                <ThemedText style={[styles.logCell, styles.cellMsg]}>{e.message}</ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.logEmpty}>
              No logs yet. Browse your inbox so summaries/triage run — rows appear here
              live. (If it stays empty, rebuild the app so log capture is included.)
            </ThemedText>
          )}
        </ScrollView>
      </View>

      <View style={styles.perfButtons}>
        <Pressable
          onPress={() => {
            setLive((v) => !v);
            refresh();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: live }}
          style={styles.perfButton}
        >
          <ThemedText type="smallBold" style={{ color: live ? Colors.primary : Colors.secondary }}>
            {live ? '● Live' : '↻ Paused'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => shareFile(exportLogs, 'text/plain', 'public.plain-text', 'logs (.txt)')}
          accessibilityRole="button"
          style={styles.perfButton}
        >
          <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
            Share log
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => shareFile(exportJson, 'application/json', 'public.json', 'metrics (.json)')}
          accessibilityRole="button"
          style={styles.perfButton}
        >
          <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
            Share JSON
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() =>
            shareFile(exportCsv, 'text/csv', 'public.comma-separated-values-text', 'metrics (.csv)')
          }
          accessibilityRole="button"
          style={styles.perfButton}
        >
          <ThemedText type="smallBold" style={{ color: Colors.secondary }}>
            Share CSV
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.perfFooter}>
        <ThemedText type="small" themeColor="textSecondary">
          Share opens the system sheet (AirDrop, Files, Mail…).
        </ThemedText>
        <Pressable onPress={onClear} accessibilityRole="button" hitSlop={Spacing.two}>
          <ThemedText type="small" themeColor="textSecondary">
            Clear
          </ThemedText>
        </Pressable>
      </View>

      {status ? (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      ) : null}
    </ThemedView>
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
            <PromptField promptKey="draft" />
            <PromptField promptKey="reply" />
            <PromptField promptKey="digest" />
            <PromptField promptKey="actions" />
            <PromptField promptKey="translate" />
            <PromptField promptKey="tone" />
          </Section>

          <Section title="Logs & performance">
            <PerfExport />
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
  perfCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.three,
  },
  perfStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  logTable: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  logBody: {
    maxHeight: 220,
  },
  logRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logRowAlt: {
    backgroundColor: Colors.backgroundElement,
  },
  logHeaderRow: {
    backgroundColor: Colors.backgroundElement,
  },
  logHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  logCell: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.text,
  },
  cellTime: {
    width: 54,
  },
  cellTag: {
    width: 56,
  },
  logTag: {
    fontWeight: '700',
  },
  cellMsg: {
    flex: 1,
  },
  logEmpty: {
    padding: Spacing.three,
  },
  perfButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  perfFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  perfButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
