import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GmailInbox } from '@/components/gmail-inbox';
import { GoogleSignIn } from '@/components/google-sign-in';
import { QvacStatus } from '@/components/qvac-status';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useGoogleAuth();

  const topInset = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;
  const bottomInset = insets.bottom + BottomTabInset + Spacing.three;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: topInset }]}>
        <ThemedText type="subtitle" style={styles.title}>
          Inbox
        </ThemedText>

        <View style={styles.qvac}>
          <QvacStatus />
        </View>

        {isAuthenticated ? (
          <GmailInbox contentInset={bottomInset} />
        ) : (
          <View style={styles.signedOut}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.prompt}>
              Sign in with Google to see your Gmail messages.
            </ThemedText>
            <GoogleSignIn />
          </View>
        )}
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
  qvac: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  signedOut: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  prompt: {
    textAlign: 'center',
  },
});

