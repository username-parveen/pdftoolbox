import { describe, expect, it, vi } from "vitest";
import type { AppearancePreferences } from "./appearance";
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearanceAttributes,
  createDefaultAppearancePreferences,
  isDefaultAppearance,
  parseAppearancePreferences,
  persistAppearancePreferences,
  resolveTheme,
  serializeAppearancePreferences,
} from "./appearance";

describe("appearance preferences", () => {
  it("uses system and olive defaults stored under a dedicated key", () => {
    expect(createDefaultAppearancePreferences()).toEqual({ theme: "system", palette: "olive" });
    expect(APPEARANCE_STORAGE_KEY).toBe("pdf-toolbox.appearance");
    expect(APPEARANCE_STORAGE_KEY).not.toMatch(/save|draft|job/i);
  });

  it("round-trips the versioned persisted format without unrelated data", () => {
    const serialized = serializeAppearancePreferences({ theme: "dark", palette: "terracotta", password: "secret", path: "C:\\private.pdf" } as AppearancePreferences);
    expect(JSON.parse(serialized)).toEqual({ version: 1, theme: "dark", palette: "terracotta" });
    expect(parseAppearancePreferences(serialized)).toEqual({ theme: "dark", palette: "terracotta" });
    expect(serialized).not.toMatch(/password|path|directory/i);
  });

  it("removes default storage rather than persisting a redundant payload", () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    persistAppearancePreferences(createDefaultAppearancePreferences(), storage);
    expect(storage.removeItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    null,
    "",
    "not-json",
    "null",
    "[]",
    JSON.stringify({ version: 2, theme: "light", palette: "olive" }),
    JSON.stringify({ version: 1, theme: "sepia", palette: "olive" }),
    JSON.stringify({ version: 1, theme: "light", palette: "purple" }),
    JSON.stringify({ version: 1, theme: "light" }),
    JSON.stringify({ version: 1, theme: "light", palette: "blue", password: "secret" }),
  ])("falls back for malformed, unknown, incomplete, or expanded payload %j", (stored) => {
    expect(parseAppearancePreferences(stored)).toEqual({ theme: "system", palette: "olive" });
  });

  it("resolves system without changing explicit themes", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("detects defaults and applies safe presentation attributes", () => {
    expect(isDefaultAppearance({ theme: "system", palette: "olive" })).toBe(true);
    expect(isDefaultAppearance({ theme: "light", palette: "olive" })).toBe(false);
    const target = document.createElement("div");
    applyAppearanceAttributes(target, { theme: "system", palette: "graphite" }, "dark");
    expect(target.dataset).toMatchObject({ theme: "dark", palette: "graphite" });
    expect(target.style.colorScheme).toBe("dark");
    expect(() => applyAppearanceAttributes(null, { theme: "system", palette: "olive" }, "light")).not.toThrow();
  });
});
