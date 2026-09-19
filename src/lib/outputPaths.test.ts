import { describe, expect, it } from "vitest";
import { createOutputNameIntent } from "./outputPaths";

describe("automatic output naming intents", () => {
  it.each([
    ["merge", "Quarterly report.pdf", "Quarterly report_merged.pdf"],
    ["extract", "Quarterly report.pdf", "Quarterly report_extracted.pdf"],
    ["remove", "Quarterly report.pdf", "Quarterly report_clean.pdf"],
    ["reorder", "Quarterly report.pdf", "Quarterly report_arranged.pdf"],
    ["rotate", "Quarterly report.pdf", "Quarterly report_rotated.pdf"],
    ["split", "Quarterly report.pdf", "Quarterly report_split.pdf"],
    ["imagesToPdf", "cover.jpg", "cover.pdf"],
    ["compress", "Quarterly report.pdf", "Quarterly report_compressed.pdf"],
    ["protect", "Quarterly report.pdf", "Quarterly report_protected.pdf"],
    ["unlock", "Quarterly report.pdf", "Quarterly report_unlocked.pdf"],
    ["metadata", "Quarterly report.pdf", "Quarterly report_without-details.pdf"],
  ] as const)("creates a direct filename for %s", (tool, source, expected) => {
    expect(createOutputNameIntent(tool, source)).toEqual({ kind: "file", name: expected });
  });

  it("creates a source-named child directory for PDF-to-images", () => {
    expect(createOutputNameIntent("pdfToImages", "Quarterly report.pdf")).toEqual({
      kind: "directory",
      name: "Quarterly report images",
    });
  });

  it("uses stable fallback names when no source is selected", () => {
    expect(createOutputNameIntent("merge", undefined)).toEqual({ kind: "file", name: "merged.pdf" });
    expect(createOutputNameIntent("pdfToImages", undefined)).toEqual({ kind: "directory", name: "PDF images" });
  });
});
