import type { ToolId, ToolOptions } from "../types/jobs";

export interface ToolDraft {
  files: string[];
  options: ToolOptions;
}

export type ToolDrafts = Record<ToolId, ToolDraft>;

export const defaultToolOptions: ToolOptions = {
  pages: "",
  rotation: 90,
  password: "",
  splitEvery: 1,
  imageFormat: "png",
  dpi: 96,
};

const toolIds: ToolId[] = ["merge", "extract", "remove", "reorder", "rotate", "split", "pdfToImages", "imagesToPdf", "compress", "protect", "unlock", "metadata"];

export function createToolDraft(): ToolDraft {
  return { files: [], options: { ...defaultToolOptions } };
}

export function createToolDrafts(): ToolDrafts {
  return Object.fromEntries(toolIds.map((id) => [id, createToolDraft()])) as ToolDrafts;
}

export function updateToolDraft(drafts: ToolDrafts, tool: ToolId, draft: ToolDraft): ToolDrafts {
  return { ...drafts, [tool]: { files: [...draft.files], options: { ...draft.options, password: "" } } };
}

export function switchToolDraft(drafts: ToolDrafts, destination: ToolId, rememberToolSettings: boolean): ToolDraft {
  if (!rememberToolSettings) return createToolDraft();
  const draft = drafts[destination];
  return { files: [...draft.files], options: { ...draft.options, password: "" } };
}
