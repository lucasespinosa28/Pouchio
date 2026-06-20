import { useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { MessageCard } from '@/components/message-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { type Mailbox, useGmail } from '@/hooks/use-gmail';
import { useTheme } from '@/hooks/use-theme';
import type { GmailMessage } from '@/lib/gmail';

// Swipe right → mark it read; swipe left → open the email.
function SwipeableCard({
  message,
  onOpen,
  onMarkRead,
}: {
  message: GmailMessage;
  onOpen: () => void;
  /** Omitted (e.g. in Sent) to disable the mark-read swipe. */
  onMarkRead?: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        onMarkRead
          ? () => (
              <View style={[styles.swipeAction, styles.swipeRead]}>
                <ThemedText style={styles.swipeText}>
                  {message.unread ? 'Mark read' : 'Read'}
                </ThemedText>
              </View>
            )
          : undefined
      }
      renderRightActions={() => (
        <View style={[styles.swipeAction, styles.swipeOpen]}>
          <ThemedText style={styles.swipeText}>Open</ThemedText>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        ref.current?.close();
        if (direction === 'left') onMarkRead?.();
        else onOpen();
      }}
    >
      <MessageCard message={message} onPress={onOpen} />
    </ReanimatedSwipeable>
  );
}

// A single toggle: on → read + unread shown; off → unread only.
function ReadToggle({ showRead, onToggle }: { showRead: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.filterRow}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: showRead }}
        style={[
          styles.filterPill,
          { backgroundColor: showRead ? theme.backgroundSelected : theme.backgroundElement },
        ]}
      >
        <ThemedText type="smallBold" themeColor={showRead ? 'text' : 'textSecondary'}>
          {showRead ? 'Read + Unread' : 'Unread only'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function SearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.searchBar}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search mail"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={Spacing.two} accessibilityLabel="Clear search">
          <ThemedText type="small" themeColor="textSecondary">
            Clear
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

export function GmailInbox({
  contentInset,
  mailbox = 'inbox',
}: {
  contentInset?: number;
  mailbox?: Mailbox;
}) {
  const theme = useTheme();
  const router = useRouter();
  const isSent = mailbox === 'sent';
  const {
    messages,
    profile,
    total,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    searchQuery,
    setSearchQuery,
    searching,
    showRead,
    setShowRead,
    markRead,
    reload,
    loadMore,
  } = useGmail(mailbox);

  const totalBanner =
    !isSent && !searching && showRead && total !== null ? (
      <ThemedView type="backgroundElement" style={styles.banner}>
        <ThemedText type="title" style={styles.bannerCount}>
          {total.toLocaleString()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          total emails{profile?.emailAddress ? ` in ${profile.emailAddress}` : ''}
        </ThemedText>
      </ThemedView>
    ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        {!isSent ? (
          <ReadToggle showRead={showRead} onToggle={() => setShowRead((v) => !v)} />
        ) : null}
      </View>
      {loading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <SwipeableCard
              message={item}
              onOpen={() => {
                // Opening an inbox email marks it read (no-op if already read).
                if (!isSent) markRead(item.id);
                router.push({ pathname: '/message/[id]', params: { id: item.id } });
              }}
              onMarkRead={isSent ? undefined : () => markRead(item.id)}
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: (contentInset ?? 0) + Spacing.three },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={theme.text} />
          }
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : null}
          ListHeaderComponent={
            totalBanner || error ? (
              <View style={styles.header}>
                {totalBanner}
                {error ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
                    {error}
                  </ThemedText>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
                {error
                  ? 'Could not load your messages.'
                  : searching
                    ? `No results for “${searchQuery.trim()}”.`
                    : isSent
                      ? 'No sent emails.'
                      : showRead
                        ? 'No messages.'
                        : 'No unread emails.'}
              </ThemedText>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrap: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  swipeOpen: {
    alignItems: 'flex-end',
    backgroundColor: Colors.secondary,
  },
  swipeRead: {
    alignItems: 'flex-start',
    backgroundColor: Colors.primary,
  },
  swipeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.half,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  footer: {
    paddingVertical: Spacing.three,
  },
  banner: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  bannerCount: {
    fontSize: 40,
    lineHeight: 44,
  },
  message: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
});
