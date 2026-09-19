import type { EngineCapabilities, JobRecord, ToolId, ToolOptions, UpdateInfo } from "./jobs";
import type { SavePreferences } from "../lib/savePreferences";
import type { AppearancePreferences, ResolvedTheme } from "../lib/appearance";

export type PresentationToast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

export type PresentationBanner = {
  kind: "error" | "warning";
  message: string;
  actionLabel?: string;
};

export type DropPresentationState = "idle" | "entering" | "valid" | "invalid" | "accepted" | "rejected" | "elevated";
export type ResultPathTarget = "file" | "folder";

export type ToolValidation = Partial<Record<"pages" | "password" | "splitEvery", string>>;

export interface PdfToolboxViewProps {
  layoutMode?: "auto" | "compact";
  active: ToolId;
  files: string[];
  options: ToolOptions;
  busy: boolean;
  capabilities?: EngineCapabilities;
  activeJob?: JobRecord;
  banner?: PresentationBanner;
  toasts: PresentationToast[];
  appearance: AppearancePreferences;
  resolvedTheme: ResolvedTheme;
  preferences: SavePreferences;
  preferencesReady: boolean;
  destination?: string;
  settingsOpen: boolean;
  resultActionFeedback?: string;
  dropState?: DropPresentationState;
  validation?: ToolValidation;
  optionsExpanded: boolean;
  onSelectTool: (tool: ToolId) => void;
  onChooseFiles: () => void;
  onRemoveFile: (index: number) => void;
  onRemoveAllFiles: () => void;
  onMoveFile: (index: number, direction: -1 | 1) => void;
  onOptionsChange: (options: ToolOptions) => void;
  onOptionsExpandedChange: (expanded: boolean) => void;
  onRun: () => void;
  onCancelJob: (id: string) => void;
  onDismissJob: () => void;
  onDismissBanner: () => void;
  onBannerAction: () => void;
  onDismissToast: (id: string) => void;
  onAppearanceChange: (appearance: AppearancePreferences) => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onPreferencesChange: (preferences: SavePreferences) => void;
  onChooseDefaultDirectory: () => void;
  onOpenOutput: (jobId: string, outputPath: string) => void;
  onRevealOutput: (jobId: string, outputPath: string) => void;
  onCopyOutputPath: (outputPath: string, target: ResultPathTarget) => void;
  onRunAgain: () => void;
  onCheckForUpdate?: () => Promise<UpdateInfo | null>;
}
