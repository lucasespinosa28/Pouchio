/**
 * A single Gmail message rendered as a tappable card. When the body has a
 * preview image (TODO #7) it shows as a large hero thumbnail at the top of the
 * card; below it sits the sender avatar + name + date, the subject, and snippet.
 */
import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useEmailSummary } from '@/hooks/use-email-summary';
import type { GmailMessage } from '@/lib/gmail';

// "Display Name <addr@x.com>" → "Display Name"; falls back to the address.
export function senderName(from: string): string {
  if (!from) return 'Unknown sender';
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<(.+)>\s*$/);
  const name = match?.[1]?.trim();
  if (name) return name;
  return match?.[2]?.trim() ?? from;
}

// First letter of the sender's name/address for the avatar.
function initial(name: string): string {
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

// Stable per-sender accent color (palette indexed by a simple string hash).
const AVATAR_COLORS = ['#E5484D', '#D6409F', '#8E4EC6', '#3E63DD', '#0091FF', '#12A594', '#30A46C', '#F76808'];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// RFC-2822 Date header → compact relative label (time today, "Jun 3", or "Jun 3, 2024").
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function MessageCardImpl({ message, onPress }: { message: GmailMessage; onPress?: () => void }) {
  const name = senderName(message.from);
  const date = formatDate(message.date);
  const { summary, loading: summarizing } = useEmailSummary(message);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <ThemedView style={styles.card}>
        {message.thumbnailUrl ? (
          <Image
            source={{ uri: message.thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : null}
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={[styles.avatar, { backgroundColor: avatarColor(name) }]}>
              <ThemedText style={styles.avatarText}>{initial(name)}</ThemedText>
            </View>
            {message.unread ? <View style={styles.unreadDot} /> : null}
            <ThemedText type="smallBold" numberOfLines={1} style={styles.sender}>
              {name}
            </ThemedText>
            {date ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
                {date}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" numberOfLines={1} style={styles.subject}>
            {message.subject}
          </ThemedText>
          {summary ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={6}>
              ✨ {summary}
            </ThemedText>
          ) : message.snippet ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {message.snippet}
            </ThemedText>
          ) : null}
          {summarizing && !summary ? (
            <View style={styles.summarizing}>
              <ActivityIndicator size="small" />
              <ThemedText type="small" themeColor="textSecondary">
                Summarizing…
              </ThemedText>
            </View>
          ) : null}
        </View>
      </ThemedView>
    </Pressable>
  );
}

export const MessageCard = memo(MessageCardImpl);

const AVATAR_SIZE = 28;
const THUMBNAIL_HEIGHT = 180;

const styles = StyleSheet.create({
  pressable: {
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    // Subtle physical lift — the Duolingo "card sits on the canvas" feel.
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumbnail: {
    width: '100%',
    height: THUMBNAIL_HEIGHT,
    backgroundColor: '#00000010',
  },
  body: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.primary,
  },
  sender: {
    flex: 1,
  },
  date: {
    flexShrink: 0,
  },
  subject: {
    fontWeight: '600',
  },
  summarizing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
