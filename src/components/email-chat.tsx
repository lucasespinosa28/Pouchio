/**
 * Floating "Ask AI" button + chat sheet for the email reader (TODO #13).
 *
 * Lets the user ask questions about the open email; answers are produced by the
 * local RAG pipeline in `useEmailChat` (retrieval over the email + completion).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { type ChatMessage, useEmailChat } from '@/hooks/use-email-chat';
import { useTheme } from '@/hooks/use-theme';

function Bubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const mine = message.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        mine
          ? { alignSelf: 'flex-end', backgroundColor: Colors.secondary }
          : { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement },
      ]}
    >
      <ThemedText type="small" style={mine ? styles.bubbleTextMine : undefined}>
        {message.text}
      </ThemedText>
    </View>
  );
}

export function EmailChat({
  emailId,
  bodyText,
}: {
  emailId: string | undefined;
  bodyText: string | undefined;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, asking, ask, embeddingStatus, embeddingProgress } = useEmailChat(
    emailId,
    bodyText,
  );

  const prepLabel =
    embeddingStatus === 'downloading'
      ? `Downloading local AI model… ${embeddingProgress ?? 0}%`
      : embeddingStatus === 'loading'
        ? `Loading local AI model… ${embeddingProgress ?? 0}%`
        : embeddingStatus === 'error'
          ? 'Could not load the local AI model.'
          : null;

  const send = () => {
    const q = input.trim();
    if (!q || asking) return;
    setInput('');
    void ask(q);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ask AI about this email"
        style={[styles.fab, { bottom: insets.bottom + Spacing.three }]}
      >
        <ThemedText style={styles.fabText}>✨ Ask AI</ThemedText>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ThemedView style={styles.sheet}>
          <View style={[styles.sheetHeader, { paddingTop: insets.top + Spacing.two }]}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              Ask about this email
            </ThemedText>
            <Pressable onPress={() => setOpen(false)} hitSlop={Spacing.two} accessibilityLabel="Close">
              <ThemedText type="smallBold" themeColor="textSecondary">
                Close
              </ThemedText>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Spacing.two}
          >
            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <Bubble message={item} />}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  {prepLabel ??
                    'Ask anything about this email — e.g. “What do they want me to do?”'}
                </ThemedText>
              }
              ListFooterComponent={
                asking ? (
                  <View style={[styles.bubble, styles.typing, { backgroundColor: theme.backgroundElement }]}>
                    <ActivityIndicator size="small" />
                  </View>
                ) : null
              }
            />

            {prepLabel && asking ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.prep}>
                {prepLabel}
              </ThemedText>
            ) : null}
            <View style={[styles.inputRow, { paddingBottom: insets.bottom + Spacing.two }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask a question…"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                returnKeyType="send"
                onSubmitEditing={send}
                editable={!asking}
              />
              <Pressable
                onPress={send}
                disabled={asking || !input.trim()}
                accessibilityLabel="Send"
                style={[styles.send, (asking || !input.trim()) && styles.sendDisabled]}
              >
                <ThemedText style={styles.sendText}>Send</ThemedText>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    // Duolingo 3D button: thick bottom edge in the shadow green.
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
  messages: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  hint: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  prep: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  typing: {
    alignSelf: 'flex-start',
  },
  bubbleTextMine: {
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  send: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderBottomWidth: 3,
    borderBottomColor: Colors.primaryShadow,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
