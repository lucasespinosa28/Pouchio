# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Expo SDK 54 — APIs change between versions. Read the versioned docs at
> https://docs.expo.dev/versions/v54.0.0/ before writing code that touches Expo APIs.

## Commands

Package manager is **bun** (see `bun.lock`); use `bun install` to set up.

- `bun run start` — start the Expo dev server (Metro)
- `bun run ios` / `bun run android` / `bun run web` — start on a specific platform
- `bun run lint` — ESLint via `expo lint`
- `bun run reset-project` — moves the starter code into `app-example/` and scaffolds a blank `app/` (one-time, for starting fresh)

There is no test runner configured. Type-check with `bunx tsc --noEmit`.

## Architecture

Expo Router app using **file-based routing** — files under `app/` map directly to routes; there is no central route table.

- `app/_layout.tsx` — root `Stack`. Wraps everything in React Navigation's `ThemeProvider` driven by the device color scheme, and registers the `(tabs)` group plus the `modal` screen.
- `app/(tabs)/_layout.tsx` — bottom `Tabs` navigator (`index` = Home, `explore` = Explore). The `(tabs)` parens make it a layout group that doesn't appear in the URL.
- `app/modal.tsx` — modally presented screen.

`expo-router/entry` is the app entry (set in `package.json` `main`), so there is no hand-written `index.js`/`App.tsx`.

### Theming convention

Color is centralized in `constants/theme.ts` (`Colors.light` / `Colors.dark`, plus per-platform `Fonts`). Components should not hardcode colors — read them through:
- `hooks/use-color-scheme.ts` (`.web.ts` variant for web) to get `'light' | 'dark'`
- `hooks/use-theme-color.ts` to resolve a named color, allowing per-call `light`/`dark` overrides

`ThemedText` and `ThemedView` in `components/` build on this pattern; prefer them over raw `Text`/`View` so light/dark mode works automatically.

### Platform-specific files

This repo uses RN's platform-suffix resolution: `.ios.tsx` / `.web.ts` files (e.g. `components/ui/icon-symbol.ios.tsx`, `hooks/use-color-scheme.web.ts`) override the base file on that platform. Add a suffixed file rather than branching with `Platform.OS` for whole-module differences.

### Config notes (`app.json`)

- `newArchEnabled: true` — New Architecture (Fabric/TurboModules) is on.
- `experiments.reactCompiler: true` — React Compiler is enabled; avoid manual `useMemo`/`useCallback` micro-optimizations it would otherwise handle.
- `experiments.typedRoutes: true` — route strings are type-checked; generated types live in `.expo/types`.
- `scheme: "pouchio"` — deep-link scheme.

The `@/*` path alias maps to the project root (`tsconfig.json`).
