import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import type { SavePreferences } from "../lib/savePreferences";
import { createDefaultAppearancePreferences, isDefaultAppearance } from "../lib/appearance";
import type { AppearancePreferences, PalettePreference, ThemePreference } from "../lib/appearance";
import type { EngineCapabilities, UpdateInfo } from "../types/jobs";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  preferences: SavePreferences;
  appearance: AppearancePreferences;
  capabilities?: EngineCapabilities;
  onChange: (preferences: SavePreferences) => void;
  onAppearanceChange: (appearance: AppearancePreferences) => void;
  onChooseDirectory: () => void;
  onCheckForUpdate: () => Promise<UpdateInfo | null>;
  onClose: () => void;
}

export function SettingsPanel({ open, triggerRef, preferences, appearance, capabilities, onChange, onAppearanceChange, onChooseDirectory, onCheckForUpdate, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    return () => triggerRef.current?.focus();
  }, [open, triggerRef]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const controls = focusableControls(panelRef.current);
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="settings-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="app-settings-title" aria-describedby="app-settings-description" onKeyDown={handleKeyDown}>
        <header>
          <div><h2 id="app-settings-title">Settings</h2><p id="app-settings-description">Customize appearance and choose where completed files go.</p></div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close settings"><Icon name="x" size={18} /></button>
        </header>

        <div className="settings-panel-body">
          <section className="appearance-settings" aria-labelledby="appearance-settings-title">
            <div className="settings-section-heading">
              <h3 id="appearance-settings-title">Appearance</h3>
              {!isDefaultAppearance(appearance) && <button type="button" className="reset-appearance" onClick={() => onAppearanceChange(createDefaultAppearancePreferences())}>Reset appearance</button>}
            </div>
            <fieldset className="appearance-theme">
              <legend>Theme</legend>
              <div className="appearance-segments">
                {(["system", "light", "dark"] as const).map((theme) => <AppearanceTheme key={theme} theme={theme} checked={appearance.theme === theme} onChange={() => onAppearanceChange({ ...appearance, theme })} />)}
              </div>
            </fieldset>
            <fieldset className="appearance-palette">
              <legend>Color</legend>
              <div className="palette-options">
                {(["olive", "graphite", "blue", "terracotta"] as const).map((palette) => <PaletteOption key={palette} palette={palette} checked={appearance.palette === palette} onChange={() => onAppearanceChange({ ...appearance, palette })} />)}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="save-settings-title">
            <h3 id="save-settings-title">Files</h3>
            <div className="save-folder-setting">
              <div><strong>Default save folder</strong><span title={preferences.defaultDirectory}>{preferences.defaultDirectory || "No folder selected"}</span></div>
              <button type="button" className="secondary-action" onClick={onChooseDirectory}>Change folder</button>
            </div>
            <SwitchRow label="Ask where to save each time" checked={preferences.askEveryTime} onChange={(askEveryTime) => onChange({ ...preferences, askEveryTime })} />
            <SwitchRow label="Open folder after completion" checked={preferences.openFolderAfterCompletion} onChange={(openFolderAfterCompletion) => onChange({ ...preferences, openFolderAfterCompletion })} />
            <SwitchRow label="Remember tool settings" detail="Keeps files and choices for this session." checked={preferences.rememberToolSettings} onChange={(rememberToolSettings) => onChange({ ...preferences, rememberToolSettings })} />
            <div className="read-only-setting"><strong>Existing files</strong><span>Auto rename</span></div>
          </section>

          <details className="diagnostics-details">
            <summary>About &amp; diagnostics</summary>
            <div>
              <p><strong>PDF Toolbox</strong> · Version 0.1.0</p>
              <p>qpdf: {capabilityText(capabilities?.qpdf, capabilities?.qpdfVersion)}</p>
              <p>PDFium: {capabilityText(capabilities?.pdfium)}</p>
              <p>Runs offline. Files stay on this device.</p>
              <p>Passwords are never saved.</p>
              <UpdateCheck onCheck={onCheckForUpdate} />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function AppearanceTheme({ theme, checked, onChange }: { theme: ThemePreference; checked: boolean; onChange: () => void }) {
  const label = theme[0].toUpperCase() + theme.slice(1);
  return <label><input type="radio" name="appearance-theme" value={theme} checked={checked} onChange={onChange} /><span>{label}</span></label>;
}

function PaletteOption({ palette, checked, onChange }: { palette: PalettePreference; checked: boolean; onChange: () => void }) {
  const name = palette[0].toUpperCase() + palette.slice(1);
  return (
    <label className={`palette-option palette-preview-${palette}`}>
      <input type="radio" name="appearance-palette" value={palette} checked={checked} onChange={onChange} />
      <span className="palette-card">
        <span className="palette-name">{name}<span className="palette-selected" aria-hidden="true">{checked ? "Selected" : ""}</span></span>
        <span className="palette-tokens" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </label>
  );
}

function focusableControls(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href]'))
    .filter((control) => control.getAttribute("aria-hidden") !== "true");
}

function SwitchRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch-row">
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function capabilityText(available: boolean | undefined, version?: string): string {
  if (available === undefined) return "Checking…";
  if (!available) return version ? `Unavailable (${version})` : "Unavailable";
  return version ? `Ready (${version})` : "Ready";
}

function UpdateCheck({ onCheck }: { onCheck: () => Promise<UpdateInfo | null> }) {
  type Status = "idle" | "checking" | "available" | "uptodate" | "error";
  const [status, setStatus] = useState<Status>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  const handleCheck = () => {
    setStatus("checking");
    onCheck()
      .then((result) => {
        if (result) {
          setInfo(result);
          setStatus("available");
        } else {
          setStatus("uptodate");
        }
      })
      .catch(() => setStatus("error"));
  };

  return (
    <div className="update-check">
      {status === "available" && info ? (
        <div>
          <p><strong>Version {info.latestVersion} is available</strong> (you have {info.currentVersion})</p>
          <a href={info.releaseUrl} target="_blank" rel="noopener noreferrer" className="secondary-action">Download update</a>
        </div>
      ) : status === "uptodate" ? (
        <p>You are up to date.</p>
      ) : status === "error" ? (
        <p>Could not check for updates. Try again.</p>
      ) : (
        <button type="button" className="secondary-action" disabled={status === "checking"} onClick={handleCheck}>
          {status === "checking" ? "Checking…" : "Check for updates"}
        </button>
      )}
    </div>
  );
}
