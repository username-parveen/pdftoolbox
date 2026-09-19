import type { ToolId } from "../types/jobs";

export interface OutputNameIntent {
  kind: "file" | "directory";
  name: string;
}

export function createOutputNameIntent(tool: ToolId, sourceName: string | undefined): OutputNameIntent {
  const stem = sourceStem(sourceName);
  if (tool === "pdfToImages") return { kind: "directory", name: stem ? `${stem} images` : "PDF images" };

  const names: Record<Exclude<ToolId, "pdfToImages">, string> = {
    merge: stem ? `${stem}_merged.pdf` : "merged.pdf",
    extract: `${stem || "document"}_extracted.pdf`,
    remove: `${stem || "document"}_clean.pdf`,
    reorder: `${stem || "document"}_arranged.pdf`,
    rotate: `${stem || "document"}_rotated.pdf`,
    split: `${stem || "document"}_split.pdf`,
    imagesToPdf: `${stem || "images"}.pdf`,
    compress: `${stem || "document"}_compressed.pdf`,
    protect: `${stem || "document"}_protected.pdf`,
    unlock: `${stem || "document"}_unlocked.pdf`,
    metadata: `${stem || "document"}_without-details.pdf`,
  };
  return { kind: "file", name: names[tool] };
}

function sourceStem(sourceName: string | undefined): string {
  if (!sourceName) return "";
  return sourceName.replace(/\.(?:pdf|jpe?g|png|webp|gif|bmp|tga|tiff?)$/i, "").trim();
}
