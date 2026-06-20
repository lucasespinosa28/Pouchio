/**
 * Google OAuth configuration.
 *
 * Client IDs come from the Google Cloud console (APIs & Services → Credentials)
 * and are exposed to the app via `EXPO_PUBLIC_*` env vars in `.env`:
 *   - iOS client  → reversed form is the `iosUrlScheme` in app.json
 *   - Web client  → used as `webClientId` so we can mint id/access tokens
 *
 * Sign-in is handled natively by `@react-native-google-signin/google-signin`,
 * so there is no web redirect URI involved.
 */

export const GoogleClientIds = {
  ios: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
  web: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
} as const;

/**
 * Extra OAuth scopes to request beyond the default profile/email. Add the Gmail
 * read scope here when wiring up email fetching (TODO #2) — note it is a
 * sensitive scope and must be added to the OAuth consent screen first.
 */
export const GmailReadScope = 'https://www.googleapis.com/auth/gmail.readonly';

/** Send scope — lets the access token send mail on the user's behalf (Compose). */
export const GmailSendScope = 'https://www.googleapis.com/auth/gmail.send';
