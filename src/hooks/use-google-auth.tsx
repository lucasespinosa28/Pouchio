/**
 * Google authentication via `@react-native-google-signin/google-signin`.
 *
 * This uses the **native** Google Sign-In SDK (not a web redirect), so there is
 * no redirect URI to register — the iOS OAuth client is matched by bundle ID +
 * the reversed-client-id URL scheme configured in `app.json`.
 *
 * Requires a native build (dev client / `expo run:ios`); it does not work in a
 * plain web bundle.
 */
import {
  GoogleSignin,
  isSuccessResponse,
  type User,
} from '@react-native-google-signin/google-signin';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { GmailReadScope, GmailSendScope, GoogleClientIds } from '@/constants/google';
import { log, logError } from '@/lib/log';

GoogleSignin.configure({
  iosClientId: GoogleClientIds.ios,
  webClientId: GoogleClientIds.web,
  // Gmail read access to list/read messages, plus send access for Compose.
  scopes: [GmailReadScope, GmailSendScope],
});

export type GoogleUser = User['user'];

type AuthContextValue = {
  /** True until the silent restore on launch has finished. */
  ready: boolean;
  /** A sign-in prompt is in flight. */
  loading: boolean;
  user: GoogleUser | null;
  isAuthenticated: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Fetch a fresh access token (for calling Google APIs e.g. Gmail). */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function GoogleAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On launch, silently restore a previously saved credential (no UI).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await GoogleSignin.signInSilently();
        log('auth', 'signInSilently', { type: res.type });
        if (!cancelled && res.type === 'success') {
          setUser(res.data.user);
        }
      } catch (e) {
        // No saved credential / restore failed — stay signed out.
        log('auth', 'signInSilently: no saved credential', e instanceof Error ? e.message : e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      loading,
      user,
      isAuthenticated: !!user,
      error,
      signIn: async () => {
        setError(null);
        setLoading(true);
        try {
          log('auth', 'signIn start');
          await GoogleSignin.hasPlayServices();
          const res = await GoogleSignin.signIn();
          log('auth', 'signIn result', { type: res.type });
          if (isSuccessResponse(res)) {
            setUser(res.data.user);
            log('auth', 'signed in', { email: res.data.user.email });
          }
          // A cancelled prompt resolves without success — leave state as-is.
        } catch (e) {
          logError('auth', e, '(signIn failed)');
          setError(e instanceof Error ? e.message : 'Sign-in failed.');
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        setError(null);
        try {
          await GoogleSignin.signOut();
        } finally {
          setUser(null);
        }
      },
      getAccessToken: async () => {
        try {
          const { accessToken } = await GoogleSignin.getTokens();
          return accessToken ?? null;
        } catch {
          return null;
        }
      },
    }),
    [ready, loading, user, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useGoogleAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return ctx;
}
