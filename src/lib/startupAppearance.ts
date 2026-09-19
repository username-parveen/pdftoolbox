import {
  APPEARANCE_STORAGE_KEY,
  DARK_THEME_MEDIA_QUERY,
  applyAppearanceAttributes,
  parseAppearancePreferences,
  resolveTheme,
} from "./appearance";
import type { AppearancePreferences, ResolvedTheme } from "./appearance";

export function initializeDocumentAppearance(
  root: HTMLElement,
  storage: Pick<Storage, "getItem"> = window.localStorage,
  matchMedia: typeof window.matchMedia = systemMatchMedia,
): { appearance: AppearancePreferences; resolvedTheme: ResolvedTheme } {
  let stored: string | null = null;
  try {
    stored = storage.getItem(APPEARANCE_STORAGE_KEY);
  } catch {
    // Blocked storage uses the safe default.
  }
  const appearance = parseAppearancePreferences(stored);
  let prefersDark = false;
  try {
    prefersDark = matchMedia(DARK_THEME_MEDIA_QUERY).matches;
  } catch {
    // Environments without matchMedia resolve System to light.
  }
  const resolvedTheme = resolveTheme(appearance.theme, prefersDark);
  applyAppearanceAttributes(root, appearance, resolvedTheme);
  return { appearance, resolvedTheme };
}

function systemMatchMedia(query: string): MediaQueryList {
  return window.matchMedia(query);
}
