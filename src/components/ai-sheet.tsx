/**
 * Shared modal chrome for the reader's AI panels (action items, translate) —
 * a slide-up sheet with a titled header, a Close button, and a scrollable body.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function AiSheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.sheet}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={Spacing.two} accessibilityLabel="Close">
            <ThemedText type="smallBold" themeColor="textSecondary">
              Close
            </ThemedText>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.four }]}>
          {children}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 20,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
