export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type PalettePreference = "olive" | "graphite" | "blue" | "terracotta";

export interface AppearancePreferences {
  theme: ThemePreference;
  palette: PalettePreference;
}

interface PersistedAppearancePreferences extends AppearancePreferences {
  version: 1;
}

export const APPEARANCE_STORAGE_KEY = "pdf-toolbox.appearance";
export const DARK_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const themes: readonly ThemePreference[] = ["system", "light", "dark"];
const palettes: readonly PalettePreference[] = ["olive", "graphite", "blue", "terracotta"];

export function createDefaultAppearancePreferences(): AppearancePreferences {
  return { theme: "system", palette: "olive" };
}

export function parseAppearancePreferences(stored: string | null): AppearancePreferences {
  if (!stored) return createDefaultAppearancePreferences();
  try {
    const value: unknown = JSON.parse(stored);
    if (!isStrictPersistedAppearance(value)) return createDefaultAppearancePreferences();
    return { theme: value.theme, palette: value.palette };
  } catch {
    return createDefaultAppearancePreferences();
  }
}

export function serializeAppearancePreferences(preferences: AppearancePreferences): string {
  const persisted: PersistedAppearancePreferences = { version: 1, theme: preferences.theme, palette: preferences.palette };
  return JSON.stringify(persisted);
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === "system" ? prefersDark ? "dark" : "light" : preference;
}

export function isDefaultAppearance(preferences: AppearancePreferences): boolean {
  return preferences.theme === "system" && preferences.palette === "olive";
}

export function applyAppearanceAttributes(target: HTMLElement | null, preferences: AppearancePreferences, resolvedTheme: ResolvedTheme): void {
  if (!target) return;
  target.dataset.theme = resolvedTheme;
  target.dataset.palette = preferences.palette;
  target.style.colorScheme = resolvedTheme;
}

export function readAppearancePreferences(storage: Pick<Storage, "getItem"> = window.localStorage): AppearancePreferences {
  try {
    return parseAppearancePreferences(storage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return createDefaultAppearancePreferences();
  }
}

export function persistAppearancePreferences(preferences: AppearancePreferences, storage: Pick<Storage, "setItem" | "removeItem"> = window.localStorage): void {
  try {
    if (isDefaultAppearance(preferences)) storage.removeItem(APPEARANCE_STORAGE_KEY);
    else storage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearancePreferences(preferences));
  } catch {
    // Appearance remains active for this session when storage is blocked.
  }
}

function isStrictPersistedAppearance(value: unknown): value is PersistedAppearancePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3
    && record.version === 1
    && themes.includes(record.theme as ThemePreference)
    && palettes.includes(record.palette as PalettePreference);
}
