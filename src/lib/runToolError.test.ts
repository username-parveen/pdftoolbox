import { describe, expect, it } from "vitest";
import { runToolFailureBanner } from "./runToolError";

describe("runToolFailureBanner", () => {
  it.each([
    [{ kind: "outputNotWritable", message: "C:\\Read only" }],
    [{ kind: "outputExists", message: "C:\\out\\result.pdf" }],
    [{ kind: "ioError", message: "Could not create the destination directory" }],
  ])("offers folder recovery only for destination failures", (cause) => {
    expect(runToolFailureBanner(cause)).toMatchObject({ actionLabel: "Choose another folder" });
  });

  it.each([
    [{ kind: "pdfCorrupt", message: "The selected PDF is malformed." }, "The selected PDF is malformed."],
    [{ kind: "ioError", message: "The input file could not be read." }, "The input file could not be read."],
    [new Error("The operation request was rejected."), "The operation request was rejected."],
  ])("reports non-destination failures without blaming the save folder", (cause, safeMessage) => {
    const banner = runToolFailureBanner(cause);
    expect(banner.actionLabel).toBeUndefined();
    expect(banner.message).toBe(`PDF Toolbox could not start the operation. ${safeMessage}`);
    expect(banner.message).not.toMatch(/save folder|save there|another folder/i);
  });

  it("uses concise generic copy for an unstructured failure", () => {
    expect(runToolFailureBanner({ unexpected: true })).toEqual({ kind: "error", message: "PDF Toolbox could not start the operation. Try again." });
  });
});
