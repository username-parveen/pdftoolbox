import { describe, expect, it, vi } from "vitest";
import { APPEARANCE_STORAGE_KEY, serializeAppearancePreferences } from "./appearance";
import { initializeDocumentAppearance } from "./startupAppearance";
import mainSource from "../main.tsx?raw";

describe("startup appearance", () => {
  it("runs before React creates the production root", () => {
    expect(mainSource.indexOf("initializeDocumentAppearance(document.documentElement)")).toBeGreaterThan(-1);
    expect(mainSource.indexOf("initializeDocumentAppearance(document.documentElement)")).toBeLessThan(mainSource.indexOf("createRoot("));
  });

  it("synchronously applies stored appearance and current system resolution", () => {
    const root = document.createElement("html");
    const storage = { getItem: vi.fn(() => serializeAppearancePreferences({ theme: "system", palette: "blue" })) };
    const matchMedia = vi.fn(() => ({ matches: true } as MediaQueryList));

    const result = initializeDocumentAppearance(root, storage, matchMedia);

    expect(storage.getItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(result).toEqual({ appearance: { theme: "system", palette: "blue" }, resolvedTheme: "dark" });
    expect(root.dataset).toMatchObject({ theme: "dark", palette: "blue" });
    expect(root.style.colorScheme).toBe("dark");
  });

  it("falls back safely when storage is blocked or invalid", () => {
    const root = document.createElement("html");
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }) };
    initializeDocumentAppearance(root, storage, () => ({ matches: false } as MediaQueryList));
    expect(root.dataset).toMatchObject({ theme: "light", palette: "olive" });
  });
});
