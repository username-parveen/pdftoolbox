export interface SavePreferences {
  defaultDirectory: string;
  askEveryTime: boolean;
  openFolderAfterCompletion: boolean;
  rememberToolSettings: boolean;
}

export const SAVE_PREFERENCES_STORAGE_KEY = "pdf-toolbox.save-preferences.v1";

const STORAGE_VERSION = 1;

export function createDefaultSavePreferences(defaultDirectory: string): SavePreferences {
  return {
    defaultDirectory,
    askEveryTime: false,
    openFolderAfterCompletion: false,
    rememberToolSettings: true,
  };
}

export function parseSavePreferences(value: string | null, fallbackDirectory: string): SavePreferences {
  const defaults = createDefaultSavePreferences(fallbackDirectory);
  if (!value) return defaults;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) return defaults;
    return {
      defaultDirectory: typeof parsed.defaultDirectory === "string" && parsed.defaultDirectory.trim() ? parsed.defaultDirectory : defaults.defaultDirectory,
      askEveryTime: typeof parsed.askEveryTime === "boolean" ? parsed.askEveryTime : defaults.askEveryTime,
      openFolderAfterCompletion: typeof parsed.openFolderAfterCompletion === "boolean" ? parsed.openFolderAfterCompletion : defaults.openFolderAfterCompletion,
      rememberToolSettings: typeof parsed.rememberToolSettings === "boolean" ? parsed.rememberToolSettings : defaults.rememberToolSettings,
    };
  } catch {
    return defaults;
  }
}

export function serializeSavePreferences(preferences: SavePreferences): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    defaultDirectory: preferences.defaultDirectory,
    askEveryTime: preferences.askEveryTime,
    openFolderAfterCompletion: preferences.openFolderAfterCompletion,
    rememberToolSettings: preferences.rememberToolSettings,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
