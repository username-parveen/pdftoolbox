import { describe, expect, it } from "vitest";
import type { ToolId, ToolOptions } from "../types/jobs";
import { defaultToolOptions } from "./toolDrafts";
import { optionMode, optionSummary, optionsDifferFromDefaults, resetToolOptions } from "./toolOptions";

const modes: Record<ToolId, "optional" | "required" | "none"> = {
  merge: "none",
  extract: "required",
  remove: "required",
  reorder: "required",
  rotate: "optional",
  split: "optional",
  pdfToImages: "optional",
  imagesToPdf: "none",
  compress: "none",
  protect: "required",
  unlock: "required",
  metadata: "none",
};

describe("tool options presentation", () => {
  it("assigns every tool to its approved option mode", () => {
    for (const [tool, mode] of Object.entries(modes)) {
      expect(optionMode(tool as ToolId)).toBe(mode);
    }
  });

  it("uses Standard image quality as the real frontend default", () => {
    expect(defaultToolOptions.dpi).toBe(96);
  });

  it.each([
    ["pdfToImages", defaultToolOptions, "PNG · Standard · All pages"],
    ["pdfToImages", { ...defaultToolOptions, imageFormat: "jpeg", dpi: 144, pages: "2-4" }, "JPEG · High · Pages 2-4"],
    ["pdfToImages", { ...defaultToolOptions, imageFormat: "webp", dpi: 300 }, "WebP · Print · All pages"],
    ["rotate", defaultToolOptions, "90° clockwise · All pages"],
    ["rotate", { ...defaultToolOptions, pages: "1-z" }, "90° clockwise · All pages"],
    ["rotate", { ...defaultToolOptions, rotation: 180, pages: "2-6" }, "180° · Pages 2-6"],
    ["rotate", { ...defaultToolOptions, rotation: 270 }, "270° clockwise · All pages"],
    ["split", defaultToolOptions, "One file per page"],
    ["split", { ...defaultToolOptions, splitEvery: 5 }, "Every 5 pages"],
  ] satisfies Array<[ToolId, ToolOptions, string]>)("summarizes %s exactly", (tool, options, summary) => {
    expect(optionSummary(tool, options)).toBe(summary);
  });

  it("reports differences only for fields relevant to the active optional tool", () => {
    expect(optionsDifferFromDefaults("pdfToImages", { ...defaultToolOptions, rotation: 270 })).toBe(false);
    expect(optionsDifferFromDefaults("pdfToImages", { ...defaultToolOptions, pages: "   " })).toBe(false);
    expect(optionsDifferFromDefaults("pdfToImages", { ...defaultToolOptions, dpi: 144 })).toBe(true);
    expect(optionsDifferFromDefaults("rotate", { ...defaultToolOptions, pages: "1-z" })).toBe(true);
    expect(optionsDifferFromDefaults("split", { ...defaultToolOptions, splitEvery: 2 })).toBe(true);
    expect(optionsDifferFromDefaults("extract", { ...defaultToolOptions, pages: "2" })).toBe(false);
  });

  it.each([
    ["pdfToImages", { ...defaultToolOptions, imageFormat: "webp", dpi: 300, pages: "2", rotation: 270, splitEvery: 8, password: "secret" }, { imageFormat: "png", dpi: 96, pages: "", rotation: 270, splitEvery: 8, password: "" }],
    ["rotate", { ...defaultToolOptions, pages: "2", rotation: 270, splitEvery: 8, password: "secret" }, { pages: "", rotation: 90, splitEvery: 8, password: "" }],
    ["split", { ...defaultToolOptions, pages: "2", splitEvery: 8, password: "secret" }, { pages: "2", splitEvery: 1, password: "" }],
  ] satisfies Array<[ToolId, ToolOptions, Partial<ToolOptions>]>)("resets only %s options and never carries a password", (tool, options, expected) => {
    expect(resetToolOptions(tool, options)).toMatchObject(expected);
  });
});
