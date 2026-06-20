/**
 * Single "✨ AI" entry point for the email reader. A floating button opens a
 * bottom-sheet menu of AI actions — Ask, Reply, Action items, Translate — each
 * of which opens its own controlled sheet. Keeps the reader to one button while
 * the AI features grow.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmailActions } from '@/components/email-actions';
import { EmailChat } from '@/components/email-chat';
import { EmailTranslate } from '@/components/email-translate';
import { SmartReplies } from '@/components/smart-replies';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import type { GmailMessageContent } from '@/lib/gmail';

type Panel = 'ask' | 'reply' | 'actions' | 'translate';

const ITEMS: { key: Panel; icon: string; label: string }[] = [
  { key: 'ask', icon: '💬', label: 'Ask about this email' },
  { key: 'reply', icon: '↩️', label: 'Suggest replies' },
  { key: 'actions', icon: '✅', label: 'Action items' },
  { key: 'translate', icon: '🌐', label: 'Translate' },
];

export function ReaderAI({ content }: { content: GmailMessageContent }) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  const choose = (key: Panel) => {
    setMenuOpen(false);
    setPanel(key);
  };

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open AI actions for this email"
        style={[styles.fab, { bottom: insets.bottom + Spacing.three }]}
      >
        <ThemedText style={styles.fabText}>✨ AI</ThemedText>
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Dismiss" />
          <ThemedView style={[styles.menu, { paddingBottom: insets.bottom + Spacing.three }]}>
            <View style={styles.handle} />
            {ITEMS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => choose(item.key)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              >
                <ThemedText style={styles.menuIcon}>{item.icon}</ThemedText>
                <ThemedText type="default" style={styles.menuLabel}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </View>
      </Modal>

      <EmailChat
        emailId={content.id}
        bodyText={content.bodyText}
        visible={panel === 'ask'}
        onClose={() => setPanel(null)}
      />
      <SmartReplies content={content} visible={panel === 'reply'} onClose={() => setPanel(null)} />
      <EmailActions
        subject={content.subject}
        bodyText={content.bodyText}
        visible={panel === 'actions'}
        onClose={() => setPanel(null)}
      />
      <EmailTranslate
        bodyText={content.bodyText}
        visible={panel === 'translate'}
        onClose={() => setPanel(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    borderBottomWidth: 4,
    borderBottomColor: Colors.primaryShadow,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menu: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  menuItemPressed: {
    backgroundColor: Colors.backgroundElement,
  },
  menuIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontWeight: '600',
  },
});
