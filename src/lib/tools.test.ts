import { describe, expect, it } from "vitest";
import { acceptsInput, buildJobRequest, fileName, isValidPageSelection, toolDefinitions } from "./tools";

describe("fileName", () => {
  it("handles Windows and POSIX paths", () => {
    expect(fileName("C:\\docs\\report.pdf")).toBe("report.pdf");
    expect(fileName("/home/user/report.pdf")).toBe("report.pdf");
  });
});

describe("acceptsInput", () => {
  it("accepts PDFs and rejects image files for PDF tools", () => {
    expect(acceptsInput("C:\\docs\\report.PDF", undefined)).toBe(true);
    expect(acceptsInput("C:\\photos\\scan.png", undefined)).toBe(false);
  });

  it("accepts every supported image extension and rejects PDFs for Images to PDF", () => {
    for (const extension of ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tga", "tif", "tiff"]) {
      expect(acceptsInput(`C:\\photos\\scan.${extension.toUpperCase()}`, "image")).toBe(true);
    }
    expect(acceptsInput("C:\\docs\\report.pdf", "image")).toBe(false);
  });
});

describe("isValidPageSelection", () => {
  it("accepts positive page numbers and ascending ranges", () => {
    expect(isValidPageSelection("1-5, 8, 11-14")).toBe(true);
    expect(isValidPageSelection("3, 1-2, 4")).toBe(true);
  });

  it("rejects empty, zero, descending, and malformed selections", () => {
    for (const value of ["", "0", "5-2", "4--9", "3, zero, 1", "1,"]) expect(isValidPageSelection(value)).toBe(false);
  });
});

describe("buildJobRequest", () => {
  it("builds a merge request with all selected files", () => {
    expect(
      buildJobRequest("merge", ["a.pdf", "b.pdf"], "merged.pdf", {
        pages: "",
        rotation: 90,
        password: "",
        splitEvery: 1,
        imageFormat: "png",
        dpi: 96,
      }),
    ).toMatchObject({
      operation: { type: "merge", inputPaths: ["a.pdf", "b.pdf"] },
      outputPath: "merged.pdf",
      conflict: "autoRename",
    });
  });

  it("rejects an extraction without a page range", () => {
    expect(() =>
      buildJobRequest("extract", ["a.pdf"], "extract.pdf", {
        pages: "",
        rotation: 90,
        password: "",
        splitEvery: 1,
        imageFormat: "png",
        dpi: 96,
      }),
    ).toThrow("page range");
  });

  it("builds a PDFium image-rendering request with optional page selection", () => {
    expect(buildJobRequest("pdfToImages", ["a.pdf"], "C:\\out", {
      pages: "1-2",
      rotation: 90,
      password: "",
      splitEvery: 1,
      imageFormat: "webp",
      dpi: 300,
    })).toMatchObject({
      operation: { type: "pdfToImages", inputPath: "a.pdf", format: "webp", dpi: 300, pageRange: "1-2" },
      outputPath: "C:\\out",
    });
  });

  it("builds an Images to PDF request that retains input ordering", () => {
    expect(buildJobRequest("imagesToPdf", ["one.jpg", "two.jpeg"], "photos.pdf", {
      pages: "",
      rotation: 90,
      password: "",
      splitEvery: 1,
      imageFormat: "png",
      dpi: 96,
    })).toMatchObject({ operation: { type: "imagesToPdf", inputPaths: ["one.jpg", "two.jpeg"] } });
  });
});

describe("toolDefinitions", () => {
  it("contains only implemented offline operations", () => {
    expect(toolDefinitions.map((tool) => tool.id)).toEqual([
      "merge",
      "extract",
      "remove",
      "reorder",
      "rotate",
      "split",
      "pdfToImages",
      "imagesToPdf",
      "compress",
      "protect",
      "unlock",
      "metadata",
    ]);
  });

  it("uses user-facing names while keeping stable tool IDs", () => {
    expect(Object.fromEntries(toolDefinitions.map((tool) => [tool.id, tool.label]))).toMatchObject({
      merge: "Merge PDFs",
      extract: "Extract pages",
      remove: "Remove pages",
      reorder: "Arrange pages",
      pdfToImages: "Convert PDF to images",
      imagesToPdf: "Make PDF from images",
      compress: "Compress PDF",
      protect: "Add password",
      unlock: "Remove password",
      metadata: "Remove document details",
    });
  });
});
