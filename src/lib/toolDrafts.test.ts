import { describe, expect, it } from "vitest";
import { createToolDrafts, defaultToolOptions, switchToolDraft, updateToolDraft } from "./toolDrafts";

describe("tool session drafts", () => {
  it("starts image conversion at Standard 96 DPI", () => {
    expect(defaultToolOptions.dpi).toBe(96);
    expect(createToolDrafts().pdfToImages.options.dpi).toBe(96);
  });

  it("restores each tool's files and settings when remembering is enabled", () => {
    let drafts = createToolDrafts();
    drafts = updateToolDraft(drafts, "merge", {
      files: ["a.pdf", "b.pdf"],
      options: { ...drafts.merge.options, pages: "1-3" },
    });

    const switched = switchToolDraft(drafts, "merge", true);
    expect(switched.files).toEqual(["a.pdf", "b.pdf"]);
    expect(switched.options.pages).toBe("1-3");
  });

  it("resets only the destination tool when remembering is disabled", () => {
    let drafts = createToolDrafts();
    drafts = updateToolDraft(drafts, "merge", { files: ["a.pdf", "b.pdf"], options: drafts.merge.options });
    drafts = updateToolDraft(drafts, "rotate", { files: ["old.pdf"], options: { ...drafts.rotate.options, rotation: 270 } });

    const switched = switchToolDraft(drafts, "rotate", false);
    expect(switched.files).toEqual([]);
    expect(switched.options.rotation).toBe(90);
    expect(drafts.merge.files).toEqual(["a.pdf", "b.pdf"]);
  });

  it("does not share mutable file or option objects between tools", () => {
    const drafts = createToolDrafts();
    expect(drafts.merge.files).not.toBe(drafts.rotate.files);
    expect(drafts.merge.options).not.toBe(drafts.rotate.options);
  });

  it("never retains passwords in remembered tool drafts", () => {
    const drafts = createToolDrafts();
    drafts.protect.options.password = "existing-secret";
    expect(switchToolDraft(drafts, "protect", true).options.password).toBe("");

    const updated = updateToolDraft(drafts, "protect", {
      files: ["a.pdf"],
      options: { ...drafts.protect.options, password: "do-not-remember" },
    });

    expect(switchToolDraft(updated, "protect", true).options.password).toBe("");
  });
});
