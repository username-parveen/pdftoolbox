import type { ToolDefinition } from "../lib/tools";
import { fileName } from "../lib/tools";
import { optionMode, optionSummary, optionsDifferFromDefaults, resetToolOptions } from "../lib/toolOptions";
import type { EngineCapabilities, JobRecord, ToolOptions } from "../types/jobs";
import type { DropPresentationState, ResultPathTarget, ToolValidation } from "../types/presentation";
import { Icon } from "./Icon";

interface WorkspaceProps {
  tool: ToolDefinition;
  files: string[];
  options: ToolOptions;
  dropState?: DropPresentationState;
  validation?: ToolValidation;
  optionsExpanded: boolean;
  disabled: boolean;
  onChoose: () => void;
  onRemove: (index: number) => void;
  onRemoveAll: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onOptions: (options: ToolOptions) => void;
  onOptionsExpandedChange: (expanded: boolean) => void;
}

interface ActionShelfProps {
  tool: ToolDefinition;
  files: string[];
  options: ToolOptions;
  busy: boolean;
  capabilities?: EngineCapabilities;
  activeJob?: JobRecord;
  validation?: ToolValidation;
  destination?: string;
  defaultDirectory: string;
  preferencesReady: boolean;
  askEveryTime: boolean;
  resultActionFeedback?: string;
  onChangeDestination: () => void;
  onRun: () => void;
  onCancel: (id: string) => void;
  onDismiss: () => void;
  onOpenOutput: (jobId: string, outputPath: string) => void;
  onRevealOutput: (jobId: string, outputPath: string) => void;
  onCopyOutputPath: (outputPath: string, target: ResultPathTarget) => void;
  onRunAgain: () => void;
}

export function Workspace({ tool, files, options, dropState = "idle", validation, optionsExpanded, disabled, onChoose, onRemove, onRemoveAll, onMove, onOptions, onOptionsExpandedChange }: WorkspaceProps) {
  return (
    <main className="workspace" id="main-workspace">
      <header className="workflow-header">
        <h1>{tool.label}</h1>
        <p>{tool.description}.</p>
      </header>

      <div className="task-content">
        <InputSection tool={tool} files={files} dropState={dropState} disabled={disabled} onChoose={onChoose} onRemove={onRemove} onRemoveAll={onRemoveAll} onMove={onMove} />
        {files.length > 0 && <ToolOptionsSection tool={tool} options={options} validation={validation} expanded={optionsExpanded} disabled={disabled} onChange={onOptions} onExpandedChange={onOptionsExpandedChange} />}
      </div>
    </main>
  );
}

function InputSection({ tool, files, dropState, disabled, onChoose, onRemove, onRemoveAll, onMove }: Pick<WorkspaceProps, "tool" | "files" | "dropState" | "disabled" | "onChoose" | "onRemove" | "onRemoveAll" | "onMove">) {
  const inputLabel = tool.inputKind === "image" ? "image" : "PDF";
  const acceptedTypes = tool.inputKind === "image" ? "JPEG, PNG, WebP, GIF, BMP, TGA, or TIFF images" : "PDF documents";
  const quantity = tool.id === "merge" ? "Two or more" : tool.multiple ? "One or more" : "One file";

  return (
    <section className="task-section input-section" aria-labelledby="input-title">
      <div className="section-heading">
        <div><h2 id="input-title">Input</h2></div>
        {files.length > 0 && tool.multiple && <span className="file-list-actions"><button type="button" disabled={disabled} onClick={onRemoveAll}>Remove all</button></span>}
      </div>

      {files.length === 0 ? (
        <FileDropSurface state={dropState ?? "idle"} inputLabel={inputLabel} acceptedTypes={acceptedTypes} quantity={quantity} disabled={disabled} onChoose={onChoose} />
      ) : (
        <>
          {dropState !== "idle" && <DropFeedback state={dropState ?? "idle"} inputLabel={inputLabel} />}
          <ol className="file-list" aria-label="Files in processing order">
            {files.map((path, index) => (
              <li className={`${tool.multiple ? "file-row" : "file-row file-row-single"}${disabled ? " is-disabled" : ""}`} key={`${path}-${index}`}>
                {tool.multiple && <span className="order-number" aria-label={`Position ${index + 1}`}>{index + 1}</span>}
                <span className={tool.inputKind === "image" ? "type-tile image-tile" : "type-tile"}>{fileType(path, inputLabel)}</span>
                <span className="file-copy" title={path}><strong>{fileName(path)}</strong><small>{parentFolderName(path)}</small><span className="visually-hidden">Full path: {path}</span></span>
                {tool.multiple && (
                  <span className="move-actions">
                    <button type="button" onClick={() => onMove(index, -1)} disabled={disabled || index === 0} aria-label={`Move ${fileName(path)} up`}><Icon name="chevronUp" size={17} /></button>
                    <button type="button" onClick={() => onMove(index, 1)} disabled={disabled || index === files.length - 1} aria-label={`Move ${fileName(path)} down`}><Icon name="chevronDown" size={17} /></button>
                  </span>
                )}
                <button type="button" className="icon-button remove-button" disabled={disabled} onClick={() => onRemove(index)} aria-label={`Remove ${fileName(path)}`}><Icon name="trash" size={17} /></button>
              </li>
            ))}
          </ol>
          <button type="button" className="add-files" disabled={disabled} onClick={onChoose} aria-keyshortcuts="Control+O"><Icon name="plus" size={17} /> {tool.multiple ? `Add ${inputLabel} files` : `Replace ${inputLabel}`}</button>
        </>
      )}
    </section>
  );
}

function FileDropSurface({ state, inputLabel, acceptedTypes, quantity, disabled, onChoose }: { state: DropPresentationState; inputLabel: string; acceptedTypes: string; quantity: string; disabled: boolean; onChoose: () => void }) {
  const content = dropContent(state, inputLabel, quantity !== "One file");
  const isError = state === "invalid" || state === "rejected";
  return (
    <div className={`drop-surface drop-${state}`} data-drop-state={state} role={isError ? "alert" : "group"} aria-label={`${content.title}. Accepts ${acceptedTypes}; ${quantity.toLowerCase()}.`} aria-describedby="drop-guidance" aria-disabled={disabled || undefined}>
      <span className="drop-icon"><Icon name={dropIcon(state)} size={24} /></span>
      <div className="drop-copy"><strong>{content.title}</strong><span>{content.detail}</span><small id="drop-guidance">{inputLabel === "image" ? "Common image formats" : "PDF"} · {quantity}</small></div>
      <button type="button" className="choose-button" disabled={disabled} onClick={onChoose} aria-keyshortcuts="Control+O">{quantity === "One file" ? "Choose file" : "Choose files"}</button>
    </div>
  );
}

function DropFeedback({ state, inputLabel }: { state: DropPresentationState; inputLabel: string }) {
  const content = dropContent(state, inputLabel);
  const isError = state === "invalid" || state === "rejected";
  return <div className={`drop-feedback drop-${state}`} role={isError ? "alert" : "status"}><Icon name={dropIcon(state)} size={16} /><span><strong>{content.title}</strong> {content.detail}</span></div>;
}

function ToolOptionsSection({ tool, options, validation, expanded, disabled, onChange, onExpandedChange }: { tool: ToolDefinition; options: ToolOptions; validation?: ToolValidation; expanded: boolean; disabled: boolean; onChange: (value: ToolOptions) => void; onExpandedChange: (expanded: boolean) => void }) {
  const mode = optionMode(tool.id);
  if (mode === "none") return null;

  if (mode === "required") {
    return (
      <section className="task-section options-section" aria-labelledby="tool-options-title">
        <div className="section-heading"><div><h2 id="tool-options-title">Options</h2></div></div>
        <div className="options-fields"><OptionFields tool={tool} options={options} validation={validation} disabled={disabled} onChange={onChange} /></div>
      </section>
    );
  }

  const forcedOpen = hasOptionalValidation(tool.id, validation);
  return (
    <section className="task-section options-section" aria-labelledby="tool-options-title">
      <details className="options-disclosure" open={expanded || forcedOpen} onToggle={(event) => {
        if (forcedOpen) {
          if (!event.currentTarget.open) event.currentTarget.open = true;
          return;
        }
        onExpandedChange(event.currentTarget.open);
      }}>
        <summary>
          <span id="tool-options-title" className="options-summary-label">Options</span>
          <span className="options-summary-value">{optionSummary(tool.id, options)}</span>
          <span className="options-chevron" aria-hidden="true"><Icon name="chevronDown" size={18} /></span>
        </summary>
        <div className="options-disclosure-content">
          <div className="options-fields"><OptionFields tool={tool} options={options} validation={validation} disabled={disabled} onChange={onChange} /></div>
          {optionsDifferFromDefaults(tool.id, options) && <button type="button" className="reset-options" disabled={disabled} onClick={() => onChange(resetToolOptions(tool.id, options))}>Reset to defaults</button>}
        </div>
      </details>
    </section>
  );
}

function OptionFields({ tool, options, validation, disabled, onChange }: { tool: ToolDefinition; options: ToolOptions; validation?: ToolValidation; disabled: boolean; onChange: (value: ToolOptions) => void }) {
  if (tool.id === "pdfToImages") return <>
    <SegmentedControl legend="Format" name="image-format" value={options.imageFormat} disabled={disabled} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }, { value: "webp", label: "WebP" }]} onChange={(imageFormat) => onChange({ ...options, imageFormat: imageFormat as ToolOptions["imageFormat"] })} />
    <SegmentedControl legend="Quality" name="dpi" value={String(options.dpi)} disabled={disabled} options={[{ value: "96", label: "Standard", detail: "96 DPI" }, { value: "144", label: "High", detail: "144 DPI" }, { value: "300", label: "Print", detail: "300 DPI" }]} onChange={(dpi) => onChange({ ...options, dpi: Number(dpi) })} />
    <PagesField tool={tool} options={options} validation={validation} disabled={disabled} onChange={onChange} />
  </>;
  if (tool.id === "rotate") return <>
    <SegmentedControl legend="Rotation" name="rotation" value={String(options.rotation)} disabled={disabled} options={[{ value: "90", label: "90° clockwise" }, { value: "180", label: "180°" }, { value: "270", label: "270° clockwise" }]} onChange={(rotation) => onChange({ ...options, rotation: Number(rotation) })} />
    <PagesField tool={tool} options={options} validation={validation} disabled={disabled} onChange={onChange} />
  </>;
  if (tool.id === "split") return <FieldRow label="Pages per file" inputId="split-every" guidance={validation?.splitEvery ?? "Enter a whole number from 1 through 10,000."} error={Boolean(validation?.splitEvery)}>
    <input id="split-every" type="number" min={1} max={10000} required value={options.splitEvery} disabled={disabled} aria-invalid={Boolean(validation?.splitEvery)} aria-describedby={validation?.splitEvery ? "split-every-error" : "split-every-help"} onChange={(event) => onChange({ ...options, splitEvery: Number(event.target.value) })} />
  </FieldRow>;
  if (tool.id === "extract" || tool.id === "remove" || tool.id === "reorder") return <PagesField tool={tool} options={options} validation={validation} disabled={disabled} onChange={onChange} />;
  if (tool.id === "protect" || tool.id === "unlock") return <FieldRow label={tool.id === "protect" ? "New password" : "Current password"} inputId="password" guidance={validation?.password ?? passwordGuidance(tool.id)} error={Boolean(validation?.password)}>
    <input id="password" type="password" autoComplete={tool.id === "protect" ? "new-password" : "current-password"} required value={options.password} disabled={disabled} aria-invalid={Boolean(validation?.password)} aria-describedby={validation?.password ? "password-error" : "password-help"} onChange={(event) => onChange({ ...options, password: event.target.value })} />
  </FieldRow>;
  return null;
}

function PagesField({ tool, options, validation, disabled, onChange }: { tool: ToolDefinition; options: ToolOptions; validation?: ToolValidation; disabled: boolean; onChange: (value: ToolOptions) => void }) {
  return <FieldRow label={pageLabel(tool.id)} inputId="pages" guidance={validation?.pages ?? pageGuidance(tool.id)} error={Boolean(validation?.pages)}>
    <input id="pages" value={options.pages} required={tool.id === "extract" || tool.id === "remove" || tool.id === "reorder"} disabled={disabled} aria-invalid={Boolean(validation?.pages)} aria-describedby={validation?.pages ? "pages-error" : "pages-help"} onChange={(event) => onChange({ ...options, pages: event.target.value })} placeholder={tool.id === "reorder" ? "3, 1-2, 4" : tool.id === "rotate" ? "Blank for all pages" : "1-5, 8, 11-14"} />
  </FieldRow>;
}

function hasOptionalValidation(tool: ToolDefinition["id"], validation: ToolValidation | undefined): boolean {
  if (tool === "split") return Boolean(validation?.splitEvery);
  if (tool === "pdfToImages" || tool === "rotate") return Boolean(validation?.pages);
  return false;
}

function FieldRow({ label, inputId, guidance, error, children }: { label: string; inputId: string; guidance: string; error: boolean; children: React.ReactNode }) {
  return <div className="field-row"><label htmlFor={inputId}>{label}</label><div>{children}<small id={`${inputId}-${error ? "error" : "help"}`} className={error ? "validation-error" : undefined} role={error ? "alert" : undefined}>{guidance}</small></div></div>;
}

function SegmentedControl({ legend, name, value, disabled, options, onChange }: { legend: string; name: string; value: string; disabled: boolean; options: Array<{ value: string; label: string; detail?: string }>; onChange: (value: string) => void }) {
  return (
    <fieldset className="field-row segmented-field" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="segmented-control">
        {options.map((option) => <label key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span><b>{option.label}</b>{option.detail && <small>{option.detail}</small>}</span></label>)}
      </div>
    </fieldset>
  );
}

export function TaskActionShelf({ tool, files, options, busy, capabilities, activeJob, validation, destination, defaultDirectory, preferencesReady, askEveryTime, resultActionFeedback, onChangeDestination, onRun, onCancel, onDismiss, onOpenOutput, onRevealOutput, onCopyOutputPath, onRunAgain }: ActionShelfProps) {
  if (activeJob) return <JobShelf job={activeJob} toolLabel={tool.label} canRunAgain={tool.id !== "protect" && tool.id !== "unlock"} feedback={resultActionFeedback} onCancel={onCancel} onDismiss={onDismiss} onOpenOutput={onOpenOutput} onRevealOutput={onRevealOutput} onCopyOutputPath={onCopyOutputPath} onRunAgain={onRunAgain} />;

  const disabledReason = actionDisabledReason(tool, files, options, capabilities, busy, validation, preferencesReady, destination, askEveryTime);
  if (files.length === 0 || (tool.id === "merge" && files.length < 2)) {
    return <footer className="action-shelf action-shelf-guidance" aria-label="Task actions" aria-disabled="true"><strong>{tool.id === "merge" ? "Add two PDFs to merge" : `Add a${tool.inputKind === "image" ? "n image" : " PDF"} to continue`}</strong></footer>;
  }

  const destinationLabel = askEveryTime ? "Ask where to save" : defaultDirectory || "Preparing save folder";
  const visibleReadiness = actionReadinessMessage(busy, capabilities, preferencesReady, destination, askEveryTime, tool);
  return (
    <footer className="action-shelf" aria-label="Task actions">
      <div className="shelf-summary" aria-live="polite">
        <div><strong>{visibleReadiness ?? "Saves to"}</strong><span title={destinationLabel}>{destinationLabel}</span></div>
        <button type="button" className="destination-change" onClick={onChangeDestination}>{askEveryTime ? "Settings" : "Change"}</button>
      </div>
      <button type="button" className={busy ? "primary-action is-loading" : "primary-action"} disabled={Boolean(disabledReason)} aria-busy={busy || undefined} aria-describedby={disabledReason ? "disabled-reason" : undefined} aria-keyshortcuts="Control+Enter" onClick={onRun}>{busy ? "Getting ready" : actionLabel(tool)}<Icon name="arrow" size={18} /></button>
      {disabledReason && <span id="disabled-reason" className="visually-hidden">{disabledReason}</span>}
    </footer>
  );
}

function JobShelf({ job, toolLabel, canRunAgain, feedback, onCancel, onDismiss, onOpenOutput, onRevealOutput, onCopyOutputPath, onRunAgain }: { job: JobRecord; toolLabel: string; canRunAgain: boolean; feedback?: string; onCancel: (id: string) => void; onDismiss: () => void; onOpenOutput: (jobId: string, outputPath: string) => void; onRevealOutput: (jobId: string, outputPath: string) => void; onCopyOutputPath: (outputPath: string, target: ResultPathTarget) => void; onRunAgain: () => void }) {
  const active = job.state === "queued" || job.state === "running";
  const completed = job.state === "completed";
  const progress = job.totalSteps > 0 ? Math.min(100, Math.round((job.currentStep / job.totalSteps) * 100)) : 0;
  const statusCopy = job.state === "queued"
    ? "Waiting to start"
    : job.state === "running"
      ? `Working… ${job.currentStep} of ${job.totalSteps}`
      : completed
        ? "Saved"
        : job.state === "failed"
          ? "Couldn’t start"
          : "Cancelled";
  const firstOutput = job.outputPaths[0];
  const hasMultipleOutputs = job.outputPaths.length > 1;
  return (
    <footer className={`action-shelf job-shelf job-${job.state}`} aria-label="Task status" aria-live="polite" aria-busy={active || undefined}>
      <div className="job-summary">
        <div className="job-heading"><strong>{statusCopy}</strong></div>
        {job.state === "failed" && <p className="job-error" role="alert">{job.error ?? job.message}</p>}
        {active && <div className="progress-row"><div className="progress-track" role="progressbar" aria-label={`${toolLabel}: ${job.message}`} aria-valuemin={0} aria-valuemax={job.totalSteps} aria-valuenow={job.currentStep} aria-valuetext={`${job.currentStep} of ${job.totalSteps}: ${job.message}`}><span style={{ width: `${progress}%` }} /></div></div>}
        {completed && firstOutput && <div className="result-destination"><strong>{job.outputPaths.length === 1 ? fileName(firstOutput) : `${job.outputPaths.length} files saved`}</strong><span title={parentPath(firstOutput)}>{parentFolderName(firstOutput)}</span></div>}
        {job.state === "failed" && <span className="preserved-copy">Check the issue, then try again</span>}
        {feedback && <span className="result-feedback" role="status">{feedback}</span>}
      </div>
      <div className="job-actions">
        {active ? <button type="button" className="secondary-action cancel-action" onClick={() => onCancel(job.id)}>Cancel</button> : (
          <>
            {completed && firstOutput && job.outputPaths.length === 1 && <button type="button" className="secondary-action" onClick={() => onOpenOutput(job.id, firstOutput)}>Open</button>}
            {completed && firstOutput && <button type="button" className="secondary-action" onClick={() => onRevealOutput(job.id, firstOutput)}>{hasMultipleOutputs ? "Open folder" : "Show in folder"}</button>}
            {completed && firstOutput && <details className="result-more" onKeyDown={handleResultMoreKeyDown}><summary>More</summary><div><button type="button" onClick={() => onCopyOutputPath(firstOutput, hasMultipleOutputs ? "folder" : "file")}>{hasMultipleOutputs ? "Copy folder path" : "Copy path"}</button>{canRunAgain && <button type="button" onClick={onRunAgain}>Run again</button>}</div></details>}
            <button type="button" className="secondary-action" onClick={onDismiss}>{completed ? "Done" : "Dismiss"}</button>
          </>
        )}
      </div>
    </footer>
  );
}

function actionDisabledReason(tool: ToolDefinition, files: string[], options: ToolOptions, capabilities: EngineCapabilities | undefined, busy: boolean, validation: ToolValidation | undefined, preferencesReady: boolean, destination: string | undefined, askEveryTime: boolean): string | undefined {
  const readiness = actionReadinessMessage(busy, capabilities, preferencesReady, destination, askEveryTime, tool);
  if (readiness) return readiness;
  if (tool.id === "merge" && files.length < 2) return "Add at least two PDFs to merge.";
  if (files.length === 0) return `Add at least one ${tool.inputKind === "image" ? "image" : "PDF"}.`;
  if (validation?.pages) return validation.pages;
  if (validation?.password) return validation.password;
  if (validation?.splitEvery) return validation.splitEvery;
  if ((tool.id === "extract" || tool.id === "remove" || tool.id === "reorder") && !options.pages.trim()) return tool.id === "remove" ? "Enter the pages to remove." : tool.id === "extract" ? "Enter the pages to extract." : "Enter the page order.";
  if (tool.id === "split" && (!Number.isInteger(options.splitEvery) || options.splitEvery < 1 || options.splitEvery > 10000)) return "Enter pages per file from 1 through 10,000.";
  if ((tool.id === "protect" || tool.id === "unlock") && !options.password) return tool.id === "protect" ? "Enter a new password." : "Enter the current password.";
  return undefined;
}

function actionReadinessMessage(busy: boolean, capabilities: EngineCapabilities | undefined, preferencesReady: boolean, destination: string | undefined, askEveryTime: boolean, tool: ToolDefinition): string | undefined {
  if (busy || !capabilities) return "Getting ready";
  if (!preferencesReady) return "Preparing save folder";
  if (!askEveryTime && !destination) return "Choose a save folder in Settings";
  const needsPdfium = tool.id === "pdfToImages";
  if (needsPdfium && !capabilities.pdfium) return "Page conversion is unavailable. Check Settings diagnostics.";
  if (!needsPdfium && !capabilities.qpdf) return "PDF processing is unavailable. Check Settings diagnostics.";
  return undefined;
}
export function actionLabel(tool: ToolDefinition): string {
  const labels: Record<ToolDefinition["id"], string> = {
    merge: "Merge PDFs", extract: "Extract pages", remove: "Remove pages", reorder: "Arrange pages", rotate: "Rotate pages", split: "Split PDF",
    imagesToPdf: "Create PDF", pdfToImages: "Convert pages",
    compress: "Compress PDF", protect: "Add password", unlock: "Remove password", metadata: "Remove document details",
  };
  return labels[tool.id];
}

function pageLabel(id: ToolDefinition["id"]): string {
  if (id === "reorder") return "Page order";
  return id === "extract" ? "Pages to extract" : "Pages (optional)";
}

function pageGuidance(id: ToolDefinition["id"]): string {
  if (id === "extract") return "Example: 1-5, 8, 11-14.";
  if (id === "reorder") return "Example: 3, 1-2, 4.";
  if (id === "rotate") return "Leave blank to rotate all pages.";
  return "Blank means every page. Example: 1-5, 8.";
}

function passwordGuidance(id: ToolDefinition["id"]): string {
  return id === "protect" ? "Required. Cleared when processing starts." : "Required. Enter the current password.";
}

function fileType(path: string, fallback: string): string {
  const extension = fileName(path).split(".").at(-1);
  return (extension && extension.length <= 4 ? extension : fallback).toUpperCase();
}

function parentPath(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const separator = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  if (separator < 0) return "";
  if (separator === 0) return normalized.slice(0, 1);
  const parent = normalized.slice(0, separator);
  return /^[A-Za-z]:$/.test(parent) ? `${parent}${normalized[separator]}` : parent;
}

function parentFolderName(path: string): string {
  const parentPathValue = parentPath(path);
  if (/^[A-Za-z]:[\\/]$/.test(parentPathValue) || parentPathValue === "/" || parentPathValue === "\\") return parentPathValue;
  const parent = parentPathValue.replace(/[\\/]+$/, "");
  const separator = Math.max(parent.lastIndexOf("\\"), parent.lastIndexOf("/"));
  return parent.slice(separator + 1) || parent || "Current folder";
}

function handleResultMoreKeyDown(event: React.KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape" || !event.currentTarget.open) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector<HTMLElement>("summary")?.focus();
}

function dropContent(state: DropPresentationState, inputLabel: string, multiple = true): { title: string; detail: string } {
  if (state === "entering") return { title: `Checking ${inputLabel} files`, detail: "Release when the files are ready." };
  if (state === "valid") return { title: `Release to add ${inputLabel} files`, detail: "These files are supported." };
  if (state === "invalid") return { title: "These files cannot be added", detail: `Choose supported ${inputLabel} files instead.` };
  if (state === "accepted") return { title: "Files added", detail: "Review the list before running the tool." };
  if (state === "rejected") return { title: "No files added", detail: `Choose supported ${inputLabel} files and try again.` };
  if (state === "elevated") return { title: "Drag and drop is unavailable", detail: "Relaunch normally or use the file chooser." };
  return { title: inputLabel === "image" ? "Drop images here" : "Drop PDF here", detail: `or choose ${multiple ? "files" : "a file"}` };
}

function dropIcon(state: DropPresentationState): Parameters<typeof Icon>[0]["name"] {
  if (state === "elevated") return "shield";
  if (state === "invalid" || state === "rejected") return "x";
  if (state === "valid" || state === "accepted") return "check";
  return "plus";
}
