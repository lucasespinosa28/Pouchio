import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { GoogleAuthProvider } from '@/hooks/use-google-auth';
import { PromptSettingsProvider } from '@/hooks/use-prompt-settings';
import { QvacProvider } from '@/hooks/use-qvac';
import { installDevPerfGuard } from '@/lib/dev-perf-guard';

// Cap React's dev-only component-render performance-measure buffer so a long
// session doesn't exhaust native memory (`std::bad_alloc`). Runs once at module
// load, before any component renders. No-op in production.
installDevPerfGuard();

// Light-only navigation theme tinted with the Duo green brand color.
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GoogleAuthProvider>
        <PromptSettingsProvider>
          <QvacProvider>
            <ThemeProvider value={NavTheme}>
              <AnimatedSplashOverlay />
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="message/[id]"
                  options={{ title: 'Email', headerBackTitle: 'Inbox' }}
                />
              </Stack>
            </ThemeProvider>
          </QvacProvider>
        </PromptSettingsProvider>
      </GoogleAuthProvider>
    </GestureHandlerRootView>
  );
}
