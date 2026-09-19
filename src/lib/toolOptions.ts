import type { ToolId, ToolOptions } from "../types/jobs";
import { defaultToolOptions } from "./toolDrafts";

export type OptionMode = "optional" | "required" | "none";

const optionModes: Record<ToolId, OptionMode> = {
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

export function optionMode(tool: ToolId): OptionMode {
  return optionModes[tool];
}

export function optionSummary(tool: ToolId, options: ToolOptions): string {
  const selection = options.pages.trim();
  const pages = !selection || (tool === "rotate" && selection.toLowerCase() === "1-z") ? "All pages" : `Pages ${selection}`;
  if (tool === "pdfToImages") return `${formatLabel(options.imageFormat)} · ${qualityLabel(options.dpi)} · ${pages}`;
  if (tool === "rotate") return `${rotationLabel(options.rotation)} · ${pages}`;
  if (tool === "split") return options.splitEvery === 1 ? "One file per page" : `Every ${options.splitEvery} pages`;
  return "";
}

export function optionsDifferFromDefaults(tool: ToolId, options: ToolOptions): boolean {
  const pagesDiffer = options.pages.trim() !== defaultToolOptions.pages.trim();
  if (tool === "pdfToImages") return options.imageFormat !== defaultToolOptions.imageFormat || options.dpi !== defaultToolOptions.dpi || pagesDiffer;
  if (tool === "rotate") return options.rotation !== defaultToolOptions.rotation || pagesDiffer;
  if (tool === "split") return options.splitEvery !== defaultToolOptions.splitEvery;
  return false;
}

export function resetToolOptions(tool: ToolId, options: ToolOptions): ToolOptions {
  const reset = { ...options, password: "" };
  if (tool === "pdfToImages") return { ...reset, imageFormat: "png", dpi: 96, pages: "" };
  if (tool === "rotate") return { ...reset, rotation: 90, pages: "" };
  if (tool === "split") return { ...reset, splitEvery: 1 };
  return reset;
}

function formatLabel(format: ToolOptions["imageFormat"]): string {
  if (format === "png") return "PNG";
  if (format === "jpeg") return "JPEG";
  return "WebP";
}

function qualityLabel(dpi: number): string {
  if (dpi === 96) return "Standard";
  if (dpi === 144) return "High";
  if (dpi === 300) return "Print";
  return `${dpi} DPI`;
}

function rotationLabel(rotation: number): string {
  if (rotation === 90) return "90° clockwise";
  if (rotation === 180) return "180°";
  if (rotation === 270) return "270° clockwise";
  return `${rotation}°`;
}
