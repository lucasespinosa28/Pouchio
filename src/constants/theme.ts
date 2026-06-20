/**
 * Light-only Duolingo-flavored palette (see `.claude/DESIGN.md`). The app does
 * not support dark mode — there is a single source of truth for color.
 *
 * Other ways to style your app: [Nativewind](https://www.nativewind.dev/),
 * [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  /** Ink — primary text. */
  text: '#3C3C3C',
  /** Muted ink for secondary text (≈4.8:1 on white — passes AA). */
  textSecondary: '#6B6B6B',
  /** Canvas. */
  background: '#FFFFFF',
  /** Surface-1 — cards, search field, chat bubbles. */
  backgroundElement: '#F7F7F7',
  /** Light-green selection tint (toggles, active pills). */
  backgroundSelected: '#D7F0BE',
  /** Hairline border for cards/buttons. */
  border: '#E5E5E5',

  /** Duo green — primary CTAs and active/brand elements. */
  primary: '#58CC02',
  /** Text on primary green. */
  onPrimary: '#FFFFFF',
  /** Darker green used for the 3D button bottom edge. */
  primaryShadow: '#58A700',
  /** Sky blue — secondary actions, links, user chat bubble. */
  secondary: '#1CB0F6',
  /** Darker blue for the 3D bottom edge of secondary (blue) buttons. */
  secondaryShadow: '#1499D6',
  /** Streak orange. */
  accentOrange: '#FF9600',
  /** XP gold. */
  accentYellow: '#FFC800',
  /** Error / wrong red. */
  accentRed: '#FF4B4B',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
