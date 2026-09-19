import { useEffect, useRef } from "react";
import { isValidPageSelection, toolDefinitions } from "../lib/tools";
import { appShortcuts, isEditableShortcutTarget, matchesShortcut, toolForShortcut } from "../lib/shortcuts";
import type { ToolOptions } from "../types/jobs";
import type { PdfToolboxViewProps } from "../types/presentation";
import { Icon } from "./Icon";
import { SettingsPanel } from "./SettingsPanel";
import { ToolSidebar } from "./ToolSidebar";
import { TaskActionShelf, Workspace } from "./Workspace";

export function PdfToolboxView(props: PdfToolboxViewProps) {
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const tool = toolDefinitions.find((item) => item.id === props.active) ?? toolDefinitions[0];
  const workspaceDisabled = props.busy || Boolean(props.activeJob);
  const validation = props.validation ?? deriveValidation(props.active, props.options);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || props.settingsOpen || isEditableShortcutTarget(event.target)) return;

      const shortcutTool = toolForShortcut(event);
      if (shortcutTool) {
        event.preventDefault();
        props.onSelectTool(shortcutTool);
        return;
      }
      if (matchesShortcut(event, appShortcuts.chooseFiles)) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(".choose-button, .add-files")?.click();
      } else if (matchesShortcut(event, appShortcuts.settings)) {
        event.preventDefault();
        props.onOpenSettings();
      } else if (matchesShortcut(event, appShortcuts.run)) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(".primary-action")?.click();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [props.settingsOpen, props.onOpenSettings, props.onSelectTool]);

  return (
    <div className={props.layoutMode === "compact" ? "app-shell layout-compact" : "app-shell"} data-theme={props.resolvedTheme} data-palette={props.appearance.palette} style={{ colorScheme: props.resolvedTheme }}>
      <a className="skip-link" href="#main-workspace">Skip to tool</a>
      <ToolSidebar active={props.active} onSelect={props.onSelectTool} settingsTriggerRef={settingsTriggerRef} onOpenSettings={props.onOpenSettings} />
      <section className="content-column" aria-label={`${tool.label} tool`}>
        <div className="workspace-region">
          {props.banner && (
            <div className={`error-banner banner-${props.banner.kind}`} role="alert">
              <Icon name={props.banner.kind === "warning" ? "info" : "x"} size={18} />
              <span>{props.banner.message}</span>
              <span className="banner-actions">{props.banner.actionLabel && <button type="button" onClick={props.onBannerAction}>{props.banner.actionLabel}</button>}<button type="button" onClick={props.onDismissBanner} aria-label={`Dismiss ${props.banner.kind}`}>Dismiss</button></span>
            </div>
          )}
          <Workspace
            tool={tool}
            files={props.files}
            options={props.options}
            dropState={props.dropState}
            validation={validation}
            optionsExpanded={props.optionsExpanded}
            disabled={workspaceDisabled}
            onChoose={props.onChooseFiles}
            onRemove={props.onRemoveFile}
            onRemoveAll={props.onRemoveAllFiles}
            onMove={props.onMoveFile}
            onOptions={props.onOptionsChange}
            onOptionsExpandedChange={props.onOptionsExpandedChange}
          />
        </div>

        <TaskActionShelf
          tool={tool}
          files={props.files}
          options={props.options}
          busy={props.busy}
          capabilities={props.capabilities}
          activeJob={props.activeJob}
          validation={validation}
          destination={props.destination}
          defaultDirectory={props.preferences.defaultDirectory}
          preferencesReady={props.preferencesReady}
          askEveryTime={props.preferences.askEveryTime}
          resultActionFeedback={props.resultActionFeedback}
          onChangeDestination={props.preferences.askEveryTime ? props.onOpenSettings : props.onChooseDefaultDirectory}
          onRun={props.onRun}
          onCancel={props.onCancelJob}
          onDismiss={props.onDismissJob}
          onOpenOutput={props.onOpenOutput}
          onRevealOutput={props.onRevealOutput}
          onCopyOutputPath={props.onCopyOutputPath}
          onRunAgain={props.onRunAgain}
        />
      </section>

      <SettingsPanel open={props.settingsOpen} triggerRef={settingsTriggerRef} appearance={props.appearance} preferences={props.preferences} capabilities={props.capabilities} onAppearanceChange={props.onAppearanceChange} onChange={props.onPreferencesChange} onChooseDirectory={props.onChooseDefaultDirectory} onCheckForUpdate={props.onCheckForUpdate ?? (() => Promise.resolve(null))} onClose={props.onCloseSettings} />

      <div className="toast-container" aria-label="Notifications" aria-live="polite">
        {props.toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
            <Icon name={toast.type === "error" ? "x" : toast.type === "success" ? "check" : "info"} size={17} />
            <span>{toast.message}</span>
            <button type="button" onClick={() => props.onDismissToast(toast.id)} aria-label={`Close notification: ${toast.message}`}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function deriveValidation(tool: PdfToolboxViewProps["active"], options: ToolOptions): PdfToolboxViewProps["validation"] {
  const pageSelectionIsValid = tool === "rotate" && options.pages.trim().toLowerCase() === "1-z" ? true : isValidPageSelection(options.pages);
  if (["pdfToImages", "extract", "remove", "reorder", "rotate"].includes(tool) && options.pages.trim() && !pageSelectionIsValid) {
    return { pages: tool === "reorder" ? "Enter an order like 3, 1-2, 4." : "Enter pages like 1-5, 8, 11-14." };
  }
  if (tool === "split" && (!Number.isInteger(options.splitEvery) || options.splitEvery < 1 || options.splitEvery > 10000)) {
    return { splitEvery: "Enter a whole number from 1 through 10,000." };
  }
  return undefined;
}
