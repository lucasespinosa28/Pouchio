/**
 * A staged loading indicator: walks through labelled steps, marking earlier ones
 * done (✓) and spinning on the current one. The model can't report sub-progress,
 * so the steps auto-advance on a timer and hold on the last until the caller
 * unmounts the loader — it conveys "work is happening" without a frozen spinner.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

export function SteppedLoader({ steps, intervalMs = 1400 }: { steps: string[]; intervalMs?: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= steps.length - 1) return;
    const t = setTimeout(() => setActive((a) => Math.min(a + 1, steps.length - 1)), intervalMs);
    return () => clearTimeout(t);
  }, [active, steps.length, intervalMs]);

  return (
    <View style={styles.container}>
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <View key={i} style={styles.row}>
            <View style={styles.icon}>
              {current ? (
                <ActivityIndicator size="small" />
              ) : done ? (
                <ThemedText style={styles.check}>✓</ThemedText>
              ) : (
                <View style={styles.pending} />
              )}
            </View>
            <ThemedText type="small" themeColor={current || done ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: Colors.primary,
    fontWeight: '800',
  },
  pending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
});
