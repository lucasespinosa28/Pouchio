import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useQvac } from '@/hooks/use-qvac';
import { useTheme } from '@/hooks/use-theme';

const DOT_COLOR: Record<string, string> = {
  ready: '#2ecc71',
  downloading: '#f1c40f',
  loading: '#f1c40f',
  error: '#e74c3c',
  idle: '#9aa0a6',
  unsupported: '#9aa0a6',
};

/**
 * Compact badge that surfaces the on-device QVAC model status: start it, show
 * download/load progress, and indicate when the local model is running.
 */
export function QvacStatus() {
  const theme = useTheme();
  const { status, progress, modelName, error, start, stop } = useQvac();

  const busy = status === 'downloading' || status === 'loading';

  let label: string;
  switch (status) {
    case 'ready':
      label = `Local model running · ${modelName}`;
      break;
    case 'downloading':
      label = `Downloading model… ${progress ?? 0}%`;
      break;
    case 'loading':
      label = `Loading model… ${progress ?? 0}%`;
      break;
    case 'error':
      label = 'Local model failed';
      break;
    case 'unsupported':
      label = 'Local AI needs a physical device';
      break;
    default:
      label = 'Local model off';
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: DOT_COLOR[status] }]} />
        <ThemedText type="small" numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>

        {busy ? <ActivityIndicator /> : null}

        {status === 'idle' || status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            onPress={start}
            style={({ pressed }) => [
              styles.action,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">
              {status === 'error' ? 'Retry' : 'Start'}
            </ThemedText>
          </Pressable>
        ) : null}

        {status === 'ready' ? (
          <Pressable
            accessibilityRole="button"
            onPress={stop}
            style={({ pressed }) => [
              styles.action,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Stop</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {busy ? (
        <View style={[styles.track, { backgroundColor: theme.background }]}>
          <View
            style={[styles.trackFill, { width: `${progress ?? 0}%`, backgroundColor: DOT_COLOR.ready }]}
          />
        </View>
      ) : null}

      {status === 'error' && error ? (
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
  },
  action: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
});
