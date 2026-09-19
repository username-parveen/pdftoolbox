import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { basename, dirname, join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { PdfToolboxView } from "./components/PdfToolboxView";
import { backend } from "./lib/backend";
import { createOutputNameIntent } from "./lib/outputPaths";
import { applyAppearanceAttributes, persistAppearancePreferences, readAppearancePreferences } from "./lib/appearance";
import type { AppearancePreferences } from "./lib/appearance";
import { useResolvedTheme } from "./lib/useResolvedTheme";
import { runToolFailureBanner } from "./lib/runToolError";
import {
  SAVE_PREFERENCES_STORAGE_KEY,
  createDefaultSavePreferences,
  parseSavePreferences,
  serializeSavePreferences,
} from "./lib/savePreferences";
import type { SavePreferences } from "./lib/savePreferences";
import { acceptsInput, buildJobRequest, toolDefinitions } from "./lib/tools";
import { createToolDraft, createToolDrafts, updateToolDraft } from "./lib/toolDrafts";
import type { EngineCapabilities, JobRecord, ToolId, ToolOptions } from "./types/jobs";
import type { DropPresentationState, PresentationBanner, ResultPathTarget } from "./types/presentation";

export default function App() {
  const [active, setActive] = useState<ToolId>("merge");
  const [appearance, setAppearance] = useState(readAppearancePreferences);
  const resolvedTheme = useResolvedTheme(appearance.theme);
  const [drafts, setDrafts] = useState(createToolDrafts);
  const [activeJob, setActiveJob] = useState<JobRecord>();
  const [jobTool, setJobTool] = useState<ToolId>();
  const [capabilities, setCapabilities] = useState<EngineCapabilities>();
  const [preferences, setPreferences] = useState<SavePreferences>(() => createDefaultSavePreferences(""));
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [resolvedDestination, setResolvedDestination] = useState<{ identity: string; path: string }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<PresentationBanner>();
  const [resultActionFeedback, setResultActionFeedback] = useState<string>();
  const [dropState, setDropState] = useState<DropPresentationState>("idle");
  const [optionsExpandedByTool, setOptionsExpandedByTool] = useState<Partial<Record<ToolId, boolean>>>({});
  const automaticallyRevealedJobs = useRef(new Set<string>());
  const tool = toolDefinitions.find((item) => item.id === active) ?? toolDefinitions[0];
  const { files, options } = drafts[active];
  const destinationIdentity = JSON.stringify([active, files[0] ?? null, preferences.defaultDirectory]);
  const destination = resolvedDestination?.identity === destinationIdentity ? resolvedDestination.path : undefined;

  useLayoutEffect(() => {
    applyAppearanceAttributes(document.documentElement, appearance, resolvedTheme);
  }, [appearance, resolvedTheme]);

  function updateAppearance(next: AppearancePreferences) {
    persistAppearancePreferences(next);
    setAppearance(next);
  }

  useEffect(() => {
    backend.capabilities().then((detected) => {
      setCapabilities(detected);
      if (detected.elevated) {
        setDropState("elevated");
        setBanner({ kind: "warning", message: "Drag and drop is unavailable while PDF Toolbox runs as administrator. Relaunch normally or choose files." });
      }
    }).catch(() => {
      setCapabilities({ qpdf: false, pdfium: false, elevated: false });
      setDropState("idle");
    });

    const stored = readStoredPreferences();
    initializeSavePreferences(stored).then(({ preferences: loaded, warning }) => {
      setPreferences(loaded);
      setPreferencesReady(true);
      if (warning) setBanner(warning);
    }).catch(() => {
      setPreferences({ ...parseSavePreferences(stored, ""), defaultDirectory: "" });
      setPreferencesReady(true);
      setBanner(missingDestinationBanner());
    });

    const unlisten = listen<JobRecord>("job://updated", ({ payload }) => {
      setActiveJob((current) => latestJobRecord(current, payload));
      if (payload.state === "queued" || payload.state === "running") setResultActionFeedback(undefined);
    });
    return () => { unlisten.then((dispose) => dispose()); };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem(SAVE_PREFERENCES_STORAGE_KEY, serializeSavePreferences(preferences));
    } catch {
      // Preferences remain available for this session when storage is blocked.
    }
  }, [preferences, preferencesReady]);

  useEffect(() => {
    let disposed = false;
    if (!preferencesReady || !preferences.defaultDirectory) {
      setResolvedDestination(undefined);
      return;
    }

    void (async () => {
      const sourceName = files[0] ? await basename(files[0]) : undefined;
      const intent = createOutputNameIntent(active, sourceName);
      const path = await join(preferences.defaultDirectory, intent.name);
      if (!disposed) setResolvedDestination({ identity: destinationIdentity, path });
    })().catch(() => {
      if (!disposed) {
        setResolvedDestination(undefined);
        if (!preferences.askEveryTime) setBanner(missingDestinationBanner());
      }
    });
    return () => { disposed = true; };
  }, [active, destinationIdentity, files, preferences.askEveryTime, preferences.defaultDirectory, preferencesReady]);

  useEffect(() => {
    let disposed = false;
    const listener = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter") {
        setDropState(event.payload.paths.some((path) => acceptsInput(path, tool.inputKind)) ? "valid" : "entering");
        return;
      }
      if (event.payload.type === "over") {
        setDropState((current) => current === "valid" ? "valid" : "entering");
        return;
      }
      if (event.payload.type === "leave") {
        setDropState("idle");
        return;
      }
      const supported = event.payload.paths.filter((path) => acceptsInput(path, tool.inputKind));
      const accepted = tool.multiple ? supported : supported.slice(0, 1);
      const skippedCount = event.payload.paths.length - accepted.length;
      if (accepted.length === 0) {
        setDropState("rejected");
        setBanner({ kind: "error", message: tool.inputKind === "image" ? "No files added. Choose JPEG, PNG, WebP, GIF, BMP, TGA, or TIFF images." : "No files added. Choose PDF files and try again." });
        return;
      }
      updateFiles((current) => tool.multiple ? [...current, ...accepted] : accepted);
      setDropState("accepted");
      setBanner(skippedCount > 0 ? { kind: "warning", message: `Added ${accepted.length} file${accepted.length === 1 ? "" : "s"}. Skipped ${skippedCount} unsupported or extra file${skippedCount === 1 ? "" : "s"}.` } : undefined);
    });
    listener.catch((cause) => {
      if (!disposed) setBanner({ kind: "error", message: `Drag and drop could not start. Use Choose files instead. ${errorMessage(cause)}` });
    });
    return () => {
      disposed = true;
      void listener.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [active, tool.inputKind, tool.multiple]);

  useEffect(() => {
    if (!preferences.openFolderAfterCompletion || activeJob?.state !== "completed" || activeJob.outputPaths.length === 0 || automaticallyRevealedJobs.current.has(activeJob.id)) return;
    automaticallyRevealedJobs.current.add(activeJob.id);
    backend.revealJobOutput(activeJob.id, activeJob.outputPaths[0]).catch(() => {
      setResultActionFeedback("The folder could not be opened. Use Show in folder to try again.");
    });
  }, [activeJob, preferences.openFolderAfterCompletion]);

  function updateFiles(update: (current: string[]) => string[]) {
    setDrafts((current) => ({ ...current, [active]: { ...current[active], files: update(current[active].files) } }));
  }

  function updateOptions(next: ToolOptions) {
    setDrafts((current) => ({ ...current, [active]: { ...current[active], options: { ...next } } }));
    resetDropPresentation();
  }

  function resetDropPresentation() {
    setDropState(capabilities?.elevated ? "elevated" : "idle");
  }

  function selectTool(next: ToolId) {
    if (next === active) {
      resetDropPresentation();
      return;
    }
    if (activeJob) {
      setBanner({ kind: "warning", message: activeJob.state === "queued" || activeJob.state === "running" ? "Finish or cancel the current job before switching tools." : "Dismiss the result before switching tools." });
      return;
    }
    if (!preferences.rememberToolSettings) {
      setDrafts((current) => ({ ...current, [next]: createToolDraft() }));
    }
    if (options.password) {
      setDrafts((current) => updateToolDraft(current, active, current[active]));
    }
    setActive(next);
    resetDropPresentation();
    setBanner(undefined);
    setResultActionFeedback(undefined);
  }

  async function chooseFiles() {
    resetDropPresentation();
    const selected = await open({
      multiple: tool.multiple,
      directory: false,
      filters: [tool.inputKind === "image"
        ? { name: "Image files", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tga", "tif", "tiff"] }
        : { name: "PDF documents", extensions: ["pdf"] }],
    });
    if (!selected) return;
    const paths = typeof selected === "string" ? [selected] : selected;
    updateFiles((current) => tool.multiple ? [...current, ...paths] : paths.slice(0, 1));
    setBanner(undefined);
  }

  async function chooseDefaultDirectory() {
    resetDropPresentation();
    try {
      const selected = await open({ title: "Choose default save folder", directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      const prepared = await backend.prepareOutputDirectory(selected);
      setPreferences((current) => ({ ...current, defaultDirectory: prepared }));
      setBanner(undefined);
    } catch {
      setBanner({ kind: "error", message: "That folder cannot be used. Choose a folder you can write to.", actionLabel: "Choose another folder" });
    }
  }

  async function runTool() {
    try {
      resetDropPresentation();
      setBanner(undefined);
      setResultActionFeedback(undefined);
      setBusy(true);
      const output = await resolveRunOutput();
      if (!output) return;
      const request = buildJobRequest(active, files, output, options);
      const job = await backend.startJob(request);
      setJobTool(active);
      setActiveJob((current) => latestJobRecord(current, job));
      if (active === "protect" || active === "unlock") updateOptions({ ...options, password: "" });
    } catch (cause) {
      setBanner(runToolFailureBanner(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resolveRunOutput(): Promise<string | undefined> {
    if (!preferences.askEveryTime) {
      if (!destination) {
        setBanner(missingDestinationBanner());
        return undefined;
      }
      return active === "pdfToImages" ? backend.prepareOutputDirectory(destination) : destination;
    }

    if (tool.outputKind === "directory") {
      const selected = await open({ title: "Choose image output folder", directory: true, multiple: false });
      return typeof selected === "string" ? selected : undefined;
    }
    const selected = await save({
      title: `Save ${tool.label} output`,
      defaultPath: destination,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    return selected ?? undefined;
  }

  function moveFile(index: number, direction: -1 | 1) {
    resetDropPresentation();
    updateFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function cancelJob(id: string) {
    try { await backend.cancelJob(id); } catch (cause) { setBanner({ kind: "error", message: `The job could not be cancelled. ${errorMessage(cause)}` }); }
  }

  function dismissJob() {
    if (activeJob?.state === "completed" && jobTool) {
      setDrafts((current) => ({ ...current, [jobTool]: createToolDraft() }));
    }
    setActiveJob(undefined);
    setJobTool(undefined);
    setResultActionFeedback(undefined);
  }

  function runAgain() {
    setActiveJob(undefined);
    setResultActionFeedback(undefined);
    void runTool();
  }

  async function openOutput(jobId: string, outputPath: string) {
    try {
      await backend.openJobOutput(jobId, outputPath);
      setResultActionFeedback("Opened the saved file.");
    } catch (cause) {
      setResultActionFeedback(`The file could not be opened. ${errorMessage(cause)}`);
    }
  }

  async function revealOutput(jobId: string, outputPath: string) {
    try {
      await backend.revealJobOutput(jobId, outputPath);
      setResultActionFeedback("Opened the save folder.");
    } catch (cause) {
      setResultActionFeedback(`The save folder could not be opened. ${errorMessage(cause)}`);
    }
  }

  async function copyOutputPath(outputPath: string, target: ResultPathTarget) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable");
      const pathToCopy = target === "folder" ? await dirname(outputPath) : outputPath;
      await navigator.clipboard.writeText(pathToCopy);
      setResultActionFeedback(target === "folder" ? "Folder path copied." : "Path copied.");
    } catch (cause) {
      setResultActionFeedback(`The path could not be copied. ${errorMessage(cause)}`);
    }
  }

  return <PdfToolboxView
    active={active}
    files={files}
    options={options}
    busy={busy}
    capabilities={capabilities}
    activeJob={activeJob}
    banner={banner}
    toasts={[]}
    appearance={appearance}
    resolvedTheme={resolvedTheme}
    preferences={preferences}
    preferencesReady={preferencesReady}
    destination={destination}
    settingsOpen={settingsOpen}
    dropState={dropState}
    optionsExpanded={Boolean(optionsExpandedByTool[active])}
    resultActionFeedback={resultActionFeedback}
    onSelectTool={selectTool}
    onChooseFiles={() => void chooseFiles()}
    onRemoveFile={(index) => { resetDropPresentation(); updateFiles((current) => current.filter((_, item) => item !== index)); }}
    onRemoveAllFiles={() => { resetDropPresentation(); updateFiles(() => []); }}
    onMoveFile={moveFile}
    onOptionsChange={updateOptions}
    onOptionsExpandedChange={(expanded) => setOptionsExpandedByTool((current) => ({ ...current, [active]: expanded }))}
    onRun={() => void runTool()}
    onCancelJob={cancelJob}
    onDismissJob={dismissJob}
    onDismissBanner={() => { resetDropPresentation(); setBanner(undefined); }}
    onBannerAction={() => void chooseDefaultDirectory()}
    onDismissToast={() => undefined}
    onAppearanceChange={updateAppearance}
    onOpenSettings={() => { resetDropPresentation(); setSettingsOpen(true); }}
    onCloseSettings={() => setSettingsOpen(false)}
    onPreferencesChange={setPreferences}
    onChooseDefaultDirectory={() => void chooseDefaultDirectory()}
    onOpenOutput={(jobId, path) => void openOutput(jobId, path)}
    onRevealOutput={(jobId, path) => void revealOutput(jobId, path)}
    onCopyOutputPath={(path, target) => void copyOutputPath(path, target)}
     onRunAgain={runAgain}
     onCheckForUpdate={async () => backend.checkForUpdate()}
   />;
}

function readStoredPreferences(): string | null {
  try {
    return window.localStorage.getItem(SAVE_PREFERENCES_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function initializeSavePreferences(stored: string | null): Promise<{ preferences: SavePreferences; warning?: PresentationBanner }> {
  let nativeDefault = "";
  try {
    nativeDefault = await backend.defaultOutputDirectory();
  } catch {
    const storedPreferences = parseSavePreferences(stored, "");
    if (!storedPreferences.defaultDirectory) throw new Error("No default save folder is available");
    const prepared = await backend.prepareOutputDirectory(storedPreferences.defaultDirectory);
    return { preferences: { ...storedPreferences, defaultDirectory: prepared } };
  }

  const loaded = parseSavePreferences(stored, nativeDefault);
  if (loaded.defaultDirectory === nativeDefault) return { preferences: loaded };
  try {
    const prepared = await backend.prepareOutputDirectory(loaded.defaultDirectory);
    return { preferences: { ...loaded, defaultDirectory: prepared } };
  } catch {
    return {
      preferences: { ...loaded, defaultDirectory: nativeDefault },
      warning: { kind: "warning", message: `Your saved folder is unavailable. Files will save to ${nativeDefault}.`, actionLabel: "Choose another folder" },
    };
  }
}

function missingDestinationBanner(): PresentationBanner {
  return { kind: "error", message: "Your default save folder is missing or unavailable. Choose another folder to continue.", actionLabel: "Choose another folder" };
}

function errorMessage(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") return cause.message;
  if (cause instanceof Error) return cause.message;
  return "Try again.";
}

function latestJobRecord(current: JobRecord | undefined, incoming: JobRecord): JobRecord {
  if (!current || current.id !== incoming.id) return incoming;
  const rank = { queued: 0, running: 1, completed: 2, failed: 2, cancelled: 2 } as const;
  if (rank[incoming.state] < rank[current.state]) return current;
  if (rank[incoming.state] === rank[current.state] && incoming.currentStep < current.currentStep) return current;
  return incoming;
}
