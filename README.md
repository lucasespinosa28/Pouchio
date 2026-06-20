
# Pouchio 📩

A Gmail client with **on-device AI**. Pouchio reads your inbox and helps you
summarize, search, triage, draft, reply, extract tasks, and translate — all with
a local LLM running on your phone. Your email content never leaves the device.

> Built with Expo (SDK 56) + Expo Router, React Native 0.85 / React 19, and the
> [QVAC SDK](https://www.npmjs.com/package/@qvac/sdk) for local inference.

<img width="630" height="1368" alt="Captura de Tela 2026-06-20 à(s) 17 11 00" src="https://github.com/user-attachments/assets/d8f291da-ceb8-48eb-9c22-543429fb75c6" />
<img width="630" height="1368" alt="Captura de Tela 2026-06-20 à(s) 17 11 38" src="https://github.com/user-attachments/assets/d3ddba26-ebb5-467c-ba46-68e5003a735b" />
<img width="630" height="1368" alt="Captura de Tela 2026-06-20 à(s) 17 13 39" src="https://github.com/user-attachments/assets/e2ed7035-65ee-47e9-a04e-1d5c57e1747e" />
<img width="630" height="1368" alt="Captura de Tela 2026-06-20 à(s) 17 14 07" src="https://github.com/user-attachments/assets/09604077-4f7f-4907-8d65-3a179bc8c5dc" />

## Features

- **Inbox** — Gmail messages as cards with sender, thumbnail, and snippet;
  infinite scroll, pull-to-refresh, and a read/unread toggle.
- **On-device summaries** — each card gets a short AI summary generated locally.
- **Auto-triage labels** — every email is classified on-device (Priority /
  Newsletter / Receipt / Social) and shown as a color-coded chip.
- **Search, two ways**
  - **Keyword** — whole-mailbox server-side Gmail search.
  - **✨ Smart** — semantic search that ranks the loaded inbox by *meaning*,
    using local text embeddings.
- **Reader with an ✨ AI menu** — open an email and tap **AI** for:
  - 💬 **Ask** — chat about the email (local RAG over its content).
  - ↩️ **Suggest replies** — drafts a few replies; pick one to open Send prefilled.
  - ✅ **Action items** — extract tasks, deadlines, and dates.
  - 🌐 **Translate** — translate the email into a chosen language.
- **Send** — compose and send mail, with **✨ Write with AI** drafting and
  **tone chips** (Formal / Casual / Shorter) to rewrite your draft.
- **Unread digest** — one-tap "✨ Summarize unread" digest of your unread mail.
- **Settings** — sign-in, local-model status, and **editable AI prompts** for
  every feature (each with reset-to-default).

Everything AI runs **locally** via QVAC — `LLAMA_3_2_1B_INST_Q4_0` for text
generation and `GTE_LARGE_FP16` for embeddings. Models download on first use.

## Requirements

- [Bun](https://bun.sh) (package manager — see `bun.lock`)
- Xcode (iOS) and/or Android Studio for native builds
- **A physical device** to use the AI features — QVAC does not run on simulators,
  emulators, or web (those fall back gracefully with the AI disabled).
- A Google Cloud OAuth client for Gmail access (see [Configuration](#configuration)).

## Getting started

```bash
# 1. Install dependencies
bun install

# 2. Configure OAuth (see below) — create .env.local

# 3. Build & run on a connected device (required for native modules + AI)
bunx expo run:ios --device
# or
bunx expo run:android
```

> Pouchio uses native modules (Google Sign-In, WebView, QVAC), so **Expo Go is
> not supported** — you need a development/native build. After the first native
> build you can iterate with `bun run start` (Metro).

### Scripts

| Command            | What it does                              |
| ------------------ | ----------------------------------------- |
| `bun run start`    | Start the Expo dev server (Metro)         |
| `bun run ios`      | Build & run on iOS (`expo run:ios`)       |
| `bun run android`  | Build & run on Android                    |
| `bun run web`      | Run in the browser (AI disabled)          |
| `bun run lint`     | Lint with `expo lint`                     |
| `bunx tsc --noEmit`| Type-check (no test runner is configured) |

## Configuration

Pouchio signs in with native Google Sign-In and calls the Gmail REST API with the
`gmail.readonly` and `gmail.send` scopes. Create a `.env.local` file in the
project root with your OAuth client IDs:

```bash
# .env.local  (git-ignored — never commit this)
EXPO_PUBLIC_IOS_CLIENT_ID=<your iOS OAuth client id>
EXPO_PUBLIC_WEB_CLIENT_ID=<your Web OAuth client id>
```

Set up the OAuth clients in the [Google Cloud Console](https://console.cloud.google.com/),
enable the **Gmail API**, and add the `gmail.send` scope to your consent screen.
The iOS reversed-client-id URL scheme is configured via the `google-signin`
plugin in `app.json` (these client IDs are public by design — there is no client
secret for native OAuth clients).

## Architecture

File-based routing with **Expo Router**; the `@/*` alias maps to `src/`.

```
src/
├── app/                      # Routes (file-based)
│   ├── _layout.tsx           # Root stack + providers (auth, prompts, QVAC)
│   ├── (tabs)/
│   │   ├── index.tsx         # Inbox
│   │   ├── send.tsx          # Compose / send + AI draft + tone
│   │   └── settings.tsx      # Account, model status, editable prompts
│   └── message/[id].tsx      # Email reader + ✨ AI menu
├── components/               # UI (cards, sheets, AI panels, themed primitives)
├── hooks/                    # Data + AI hooks (Gmail, QVAC, summaries, triage…)
├── constants/theme.ts        # Light-only Duolingo-flavored design tokens
└── lib/gmail.ts              # Gmail REST API + RFC 2822 message building
```

Key pieces:

- **`hooks/use-qvac.tsx`** — loads the local models and serializes every engine
  call (completion + embeddings) through one queue, since the native engine runs
  one job at a time.
- **`hooks/use-prompt-settings.tsx`** — user-editable instruction prompts,
  persisted as JSON; the dynamic email context is always appended in code so a
  custom prompt can't break injection.
- **`hooks/use-google-auth.tsx` / `lib/gmail.ts`** — auth and the Gmail data layer.

Notable config (`app.json`): New Architecture is on, and `experiments`
enables the **React Compiler** (avoid manual `useMemo`/`useCallback`) and
**typed routes**.

## Privacy

All AI inference — summaries, triage, search embeddings, drafting, replies,
action items, translation, and the unread digest — runs **on-device**. Email
content is sent to Google's Gmail API (to read and send your mail) but is never
sent to any third-party AI service.

## Reproducibility & test hardware

All AI in Pouchio runs **on-device**. The build below was developed and demoed on
a single retail phone — no cloud inference, no compute cluster.

**Test device (one line per spec):**

- **CPU:** Hexa-core, with 2 performance cores at 4.26 GHz and 4 efficiency cores.
- **GPU:** Apple GPU with 5 cores.
- **RAM:** 12 GB.
- **Storage:** 256 GB.

**Models (downloaded on first use, then cached on-device):**

- `LLAMA_3_2_1B_INST_Q4_0` — text generation (summaries, triage, RAG chat,
  replies, action items, translation, digest, tone).
- `GTE_LARGE_FP16` — text embeddings (semantic "Smart" search + RAG retrieval).

**Reproduce the demo:**

1. Install [Bun](https://bun.sh) and the platform toolchain (Xcode for iOS).
2. `bun install`
3. Create `.env.local` with your Google OAuth client IDs (see
   [Configuration](#configuration)).
4. Build to a **connected physical device** (Expo Go is not supported):
   ```bash
   bunx expo run:ios --device     # or: bunx expo run:android
   ```
5. Sign in with Google. On first launch the QVAC models download once — wait for
   the **Local AI** status in **Settings** to show *ready*.
6. Exercise each feature: inbox summaries + triage chips, keyword vs. ✨ Smart
   search, the reader's ✨ AI menu (Ask / Reply / Action items / Translate), Send
   with ✨ Write-with-AI + tone chips, and the inbox "✨ Summarize unread" digest.

> The only network calls are Gmail (read/send) and Google Sign-In — all AI
> inference happens locally and continues to work in airplane mode once the
> models are cached.

## Further reading

The `docs/` folder contains the QVAC / on-device AI integration guides used while
building this app (`expo.md`, `rag.md`, `text-generation.md`,
`text-embeddings.md`, and more).

## License

Licensed under the [Apache License 2.0](./LICENSE).
