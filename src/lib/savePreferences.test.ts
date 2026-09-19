import { describe, expect, it } from "vitest";
import {
  SAVE_PREFERENCES_STORAGE_KEY,
  createDefaultSavePreferences,
  parseSavePreferences,
  serializeSavePreferences,
} from "./savePreferences";

describe("save preferences", () => {
  it("uses safe automatic-save defaults", () => {
    expect(createDefaultSavePreferences("C:\\Users\\A\\Downloads\\PDF Toolbox")).toEqual({
      defaultDirectory: "C:\\Users\\A\\Downloads\\PDF Toolbox",
      askEveryTime: false,
      openFolderAfterCompletion: false,
      rememberToolSettings: true,
    });
    expect(SAVE_PREFERENCES_STORAGE_KEY).toContain("v1");
  });

  it("parses a complete stored preference record", () => {
    const stored = JSON.stringify({
      version: 1,
      defaultDirectory: "D:\\Exports",
      askEveryTime: true,
      openFolderAfterCompletion: true,
      rememberToolSettings: false,
    });

    expect(parseSavePreferences(stored, "C:\\Fallback")).toEqual({
      defaultDirectory: "D:\\Exports",
      askEveryTime: true,
      openFolderAfterCompletion: true,
      rememberToolSettings: false,
    });
  });

  it("falls back field by field for malformed, unknown, or stale data", () => {
    const defaults = createDefaultSavePreferences("C:\\Fallback");
    expect(parseSavePreferences("not json", "C:\\Fallback")).toEqual(defaults);
    expect(parseSavePreferences(JSON.stringify({ version: 2, defaultDirectory: "D:\\Old" }), "C:\\Fallback")).toEqual(defaults);
    expect(parseSavePreferences(JSON.stringify({ version: 1, defaultDirectory: "", askEveryTime: "yes" }), "C:\\Fallback")).toEqual(defaults);
  });

  it("serializes only the versioned, non-sensitive preference fields", () => {
    const serialized = serializeSavePreferences({
      defaultDirectory: "D:\\Exports",
      askEveryTime: false,
      openFolderAfterCompletion: true,
      rememberToolSettings: true,
      password: "must-not-be-stored",
    } as Parameters<typeof serializeSavePreferences>[0] & { password: string });
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      defaultDirectory: "D:\\Exports",
      askEveryTime: false,
      openFolderAfterCompletion: true,
      rememberToolSettings: true,
    });
    expect(serialized.toLowerCase()).not.toContain("password");
  });
});
