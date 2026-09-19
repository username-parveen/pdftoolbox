import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { appShortcuts, toolShortcuts } from "../lib/shortcuts";
import { toolDefinitions } from "../lib/tools";
import type { ToolDefinition } from "../lib/tools";
import type { ToolId } from "../types/jobs";
import { Icon } from "./Icon";

interface ToolSidebarProps {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
  settingsTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
}

const groups = ["Organize", "Convert", "Optimize", "Security"] as const;

type ActiveTooltip = {
  tool: ToolDefinition;
  left: number;
  top: number;
};

export function ToolSidebar({ active, onSelect, settingsTriggerRef, onOpenSettings }: ToolSidebarProps) {
  const [tooltip, setTooltip] = useState<ActiveTooltip>();
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(tooltipTimer.current), []);

  function showTooltip(tool: ToolDefinition, anchor: HTMLButtonElement, delay: number) {
    clearTimeout(tooltipTimer.current);
    const rect = anchor.getBoundingClientRect();
    const nextTooltip = {
      tool,
      left: Math.min(rect.right + 10, window.innerWidth - 290),
      top: Math.max(48, Math.min(rect.top + rect.height / 2, window.innerHeight - 72)),
    };
    if (delay === 0) {
      setTooltip(nextTooltip);
      return;
    }
    tooltipTimer.current = setTimeout(() => {
      setTooltip({
        ...nextTooltip,
      });
    }, delay);
  }

  function hideTooltip() {
    clearTimeout(tooltipTimer.current);
    setTooltip(undefined);
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Icon name="toolsFile" size={22} /></span>
        <strong>PDF Toolbox</strong>
      </div>

      <nav className="tool-nav" aria-label="PDF tools">
        {groups.map((group) => (
          <div key={group} className="tool-group">
            <p className="tool-group-label">{group}</p>
            {toolDefinitions.filter((tool) => tool.group === group).map((tool) => (
              <button
                type="button"
                key={tool.id}
                className={active === tool.id ? "tool-button active" : "tool-button"}
                onClick={() => onSelect(tool.id)}
                onPointerEnter={(event) => showTooltip(tool, event.currentTarget, 450)}
                onPointerLeave={hideTooltip}
                onFocus={(event) => showTooltip(tool, event.currentTarget, 0)}
                onBlur={hideTooltip}
                aria-current={active === tool.id ? "page" : undefined}
                aria-keyshortcuts={toolShortcuts[tool.id].aria}
                aria-describedby={tooltip?.tool.id === tool.id ? `tool-tooltip-${tool.id}` : undefined}
              >
                <ToolIcon id={tool.id} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="privacy-status" role="status" aria-label="Privacy">
          <Icon name="shield" size={16} />
          <strong>Private &amp; offline</strong>
        </div>
        <button ref={settingsTriggerRef} type="button" className="sidebar-settings" onClick={onOpenSettings} aria-keyshortcuts={appShortcuts.settings.aria}>
          <Icon name="settings" size={17} />
          <span>Settings</span>
        </button>
      </div>
      {tooltip && createPortal(
        <div id={`tool-tooltip-${tooltip.tool.id}`} className="m3-rich-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>
          <span className="m3-tooltip-heading"><strong>{tooltip.tool.label}</strong><kbd>{toolShortcuts[tooltip.tool.id].display}</kbd></span>
          <span>{tooltip.tool.description}</span>
        </div>,
        document.body,
      )}
    </aside>
  );
}

function ToolIcon({ id }: { id: ToolId }) {
  const names: Record<ToolId, Parameters<typeof Icon>[0]["name"]> = {
    merge: "layers", extract: "file", remove: "trash", reorder: "archive", rotate: "rotate", split: "scissors",
    pdfToImages: "image", imagesToPdf: "plus",
    compress: "minus", protect: "lock", unlock: "unlock", metadata: "shield",
  };
  return <span className="tool-icon"><Icon name={names[id]} size={18} /></span>;
}
