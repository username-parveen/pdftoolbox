export type ToolId =
  | "merge"
  | "extract"
  | "remove"
  | "reorder"
  | "rotate"
  | "split"
  | "pdfToImages"
  | "imagesToPdf"
  | "compress"
  | "protect"
  | "unlock"
  | "metadata";

export type ConflictResolution = "autoRename" | "overwrite" | "skip";

export type Operation =
  | { type: "merge"; inputPaths: string[] }
  | { type: "extract"; inputPath: string; pages: string }
  | { type: "remove"; inputPath: string; pages: string }
  | { type: "reorder"; inputPath: string; pages: string }
  | { type: "rotate"; inputPath: string; pages: string; degrees: number }
  | { type: "split"; inputPath: string; every: number }
  | { type: "pdfToImages"; inputPath: string; format: "jpeg" | "png" | "webp"; dpi: number; pageRange?: string }
  | { type: "imagesToPdf"; inputPaths: string[] }
  | { type: "compress"; inputPath: string }
  | { type: "protect"; inputPath: string; userPassword: string; ownerPassword: string }
  | { type: "unlock"; inputPath: string; password: string }
  | { type: "metadata"; inputPath: string };

export interface JobRequest {
  operation: Operation;
  outputPath: string;
  conflict: ConflictResolution;
}

export type JobState = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobRecord {
  id: string;
  tool: string;
  state: JobState;
  currentStep: number;
  totalSteps: number;
  message: string;
  outputPaths: string[];
  error?: string;
}

export interface EngineCapabilities {
  qpdf: boolean;
  qpdfVersion?: string;
  pdfium: boolean;
  elevated: boolean;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

export interface ToolOptions {
  pages: string;
  rotation: number;
  password: string;
  splitEvery: number;
  imageFormat: "jpeg" | "png" | "webp";
  dpi: number;
}
