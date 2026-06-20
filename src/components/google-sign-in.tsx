import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';

/**
 * Sign-in / signed-in card. Shows a "Continue with Google" button when signed
 * out, and the user's profile with a sign-out action when signed in.
 */
export function GoogleSignIn() {
  const { ready, loading, isAuthenticated, user, error, signIn, signOut } = useGoogleAuth();

  if (!ready) {
    return <ActivityIndicator />;
  }

  if (isAuthenticated && user) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.profileRow}>
          {user.photo ? (
            <Image source={{ uri: user.photo }} style={styles.avatar} contentFit="cover" />
          ) : null}
          <View style={styles.profileText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {user.name ?? 'Signed in'}
            </ThemedText>
            {user.email ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {user.email}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={({ pressed }) => [
            styles.button,
            { borderColor: Colors.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={signIn}
        style={({ pressed }) => [
          styles.button,
          styles.primaryButton,
          { borderColor: Colors.border },
          pressed && styles.pressed,
          loading && styles.pressed,
        ]}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Image
              source={{ uri: 'https://www.google.com/favicon.ico' }}
              style={styles.googleIcon}
              contentFit="contain"
            />
            <ThemedText type="smallBold">Continue with Google</ThemedText>
          </>
        )}
      </Pressable>
      {error ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileText: {
    flex: 1,
    gap: Spacing.half,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: Colors.background,
    borderWidth: 2,
    // Duolingo 3D button: thicker bottom edge.
    borderBottomWidth: 4,
  },
  primaryButton: {
    minHeight: 52,
  },
  pressed: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  error: {
    textAlign: 'center',
  },
});
