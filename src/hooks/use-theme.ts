/**
 * The app is light-only (see `.claude/DESIGN.md`), so the theme is a single
 * constant palette — no device color-scheme lookup.
 */

import { Colors } from '@/constants/theme';

export function useTheme() {
  return Colors;
}
