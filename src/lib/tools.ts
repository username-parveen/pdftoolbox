import type { JobRequest, ToolId, ToolOptions } from "../types/jobs";

export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;
  group: "Convert" | "Organize" | "Optimize" | "Security";
  multiple: boolean;
  outputKind: "file" | "pattern" | "directory";
  inputKind?: "image";
}

export const toolDefinitions: ToolDefinition[] = [
  { id: "merge", label: "Merge PDFs", description: "Combine documents in order", group: "Organize", multiple: true, outputKind: "file" },
  { id: "extract", label: "Extract pages", description: "Copy selected pages into a new PDF", group: "Organize", multiple: false, outputKind: "file" },
  { id: "remove", label: "Remove pages", description: "Delete selected pages and keep the rest", group: "Organize", multiple: false, outputKind: "file" },
  { id: "reorder", label: "Arrange pages", description: "Create a PDF with pages in a new order", group: "Organize", multiple: false, outputKind: "file" },
  { id: "rotate", label: "Rotate pages", description: "Rotate all or selected pages", group: "Organize", multiple: false, outputKind: "file" },
  { id: "split", label: "Split PDF", description: "Create files every N pages", group: "Organize", multiple: false, outputKind: "pattern" },
  { id: "pdfToImages", label: "Convert PDF to images", description: "Turn PDF pages into PNG, JPEG, or WebP images", group: "Convert", multiple: false, outputKind: "directory" },
  { id: "imagesToPdf", label: "Make PDF from images", description: "Combine images into one PDF in the order shown", group: "Convert", multiple: true, outputKind: "file", inputKind: "image" },
  { id: "compress", label: "Compress PDF", description: "Reduce file size without turning pages into images", group: "Optimize", multiple: false, outputKind: "file" },
  { id: "protect", label: "Add password", description: "Protect a PDF with a password", group: "Security", multiple: false, outputKind: "file" },
  { id: "unlock", label: "Remove password", description: "Create an unlocked copy using the current password", group: "Security", multiple: false, outputKind: "file" },
  { id: "metadata", label: "Remove document details", description: "Remove most saved document information", group: "Security", multiple: false, outputKind: "file" },
];

export function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

export function acceptsInput(path: string, inputKind: ToolDefinition["inputKind"]): boolean {
  const lower = path.toLowerCase();
  return inputKind === "image"
    ? [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tga", ".tif", ".tiff"].some((extension) => lower.endsWith(extension))
    : lower.endsWith(".pdf");
}

export function isValidPageSelection(value: string): boolean {
  const segments = value.split(",").map((segment) => segment.trim());
  if (segments.length === 0 || segments.some((segment) => !/^\d+(?:-\d+)?$/.test(segment))) return false;
  return segments.every((segment) => {
    const [start, end = start] = segment.split("-").map(Number);
    return start >= 1 && end >= start;
  });
}

export function buildJobRequest(
  tool: ToolId,
  files: string[],
  outputPath: string,
  options: ToolOptions,
): JobRequest {
  if (files.length === 0) throw new Error("Select at least one PDF.");
  if (!outputPath.trim()) throw new Error("Choose an output path.");
  if (tool === "merge" && files.length < 2) throw new Error("Merge requires at least two PDFs.");
  if ((tool === "extract" || tool === "reorder") && !options.pages.trim()) {
    throw new Error("Enter a page range or sequence.");
  }
  if (tool === "protect" && !options.password) throw new Error("Enter a password.");

  const first = files[0];
  const operation = (() => {
    switch (tool) {
      case "merge": return { type: "merge" as const, inputPaths: files };
      case "extract": return { type: "extract" as const, inputPath: first, pages: options.pages };
      case "remove": return { type: "remove" as const, inputPath: first, pages: options.pages };
      case "reorder": return { type: "reorder" as const, inputPath: first, pages: options.pages };
      case "rotate": return { type: "rotate" as const, inputPath: first, pages: options.pages || "1-z", degrees: options.rotation };
      case "split": return { type: "split" as const, inputPath: first, every: options.splitEvery };
      case "pdfToImages": return { type: "pdfToImages" as const, inputPath: first, format: options.imageFormat, dpi: options.dpi, pageRange: options.pages.trim() || undefined };
      case "imagesToPdf": return { type: "imagesToPdf" as const, inputPaths: files };
      case "compress": return { type: "compress" as const, inputPath: first };
      case "protect": return { type: "protect" as const, inputPath: first, userPassword: options.password, ownerPassword: "" };
      case "unlock": return { type: "unlock" as const, inputPath: first, password: options.password };
      case "metadata": return { type: "metadata" as const, inputPath: first };
    }
  })();

  return { operation, outputPath, conflict: "autoRename" };
}
