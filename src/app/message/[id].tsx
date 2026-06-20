/**
 * Full email reader (TODO #9). Fetches the message's full HTML body and renders
 * it in a WebView so images and original formatting show; links open in the
 * system browser. Falls back to plain text when there's no HTML part.
 *
 * A floating "Ask AI" button (TODO #13) lets the user ask about the email.
 */
import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { EmailChat } from '@/components/email-chat';
import { senderName } from '@/components/message-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { getMessageContent, type GmailMessageContent } from '@/lib/gmail';
import { logError } from '@/lib/log';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Wrap the email body in a responsive document so images/tables fit the screen.
function buildDocument(content: GmailMessageContent): string {
  const body = content.html
    ? content.html
    : `<pre style="white-space:pre-wrap;font-family:-apple-system,Segoe UI,Roboto,sans-serif">${escapeHtml(content.text)}</pre>`;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:16px; background:#ffffff; color:#111111;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:16px; line-height:1.5;
    word-wrap:break-word; overflow-wrap:break-word; }
  img, video { max-width:100% !important; height:auto !important; }
  table { max-width:100% !important; }
  a { color:#1CB0F6; }
</style></head><body>${body}</body></html>`;
}

function formatDate(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
}

export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState<GmailMessageContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        setError('Not signed in.');
        return;
      }
      try {
        const data = await getMessageContent(token, id);
        if (!cancelled) setContent(data);
      } catch (e) {
        logError('reader', e, id);
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the email.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getAccessToken]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: content?.subject ?? 'Email' }} />
      {content ? (
        <>
          <View style={styles.headerBlock}>
            <ThemedText type="subtitle" style={styles.subject}>
              {content.subject}
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1}>
              {senderName(content.from)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(content.date)}
            </ThemedText>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: buildDocument(content) }}
            style={[styles.webview, { marginBottom: insets.bottom }]}
            // Open tapped links in the system browser instead of inside the reader.
            onShouldStartLoadWithRequest={(request) => {
              if (/^https?:\/\//i.test(request.url)) {
                void WebBrowser.openBrowserAsync(request.url);
                return false;
              }
              return true;
            }}
          />
          <EmailChat emailId={content.id} bodyText={content.bodyText} />
        </>
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlock: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  subject: {
    fontSize: 22,
    lineHeight: 28,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
});
