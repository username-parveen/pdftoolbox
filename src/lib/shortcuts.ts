import type { ToolId } from "../types/jobs";

export type KeyboardShortcut = {
  key: string;
  display: string;
  aria: string;
  alt?: boolean;
  controlOrMeta?: boolean;
};

export const toolShortcuts: Record<ToolId, KeyboardShortcut> = {
  merge: { key: "m", display: "Alt+M", aria: "Alt+M", alt: true },
  extract: { key: "e", display: "Alt+E", aria: "Alt+E", alt: true },
  remove: { key: "x", display: "Alt+X", aria: "Alt+X", alt: true },
  reorder: { key: "a", display: "Alt+A", aria: "Alt+A", alt: true },
  rotate: { key: "r", display: "Alt+R", aria: "Alt+R", alt: true },
  split: { key: "s", display: "Alt+S", aria: "Alt+S", alt: true },
  pdfToImages: { key: "v", display: "Alt+V", aria: "Alt+V", alt: true },
  imagesToPdf: { key: "i", display: "Alt+I", aria: "Alt+I", alt: true },
  compress: { key: "c", display: "Alt+C", aria: "Alt+C", alt: true },
  protect: { key: "p", display: "Alt+P", aria: "Alt+P", alt: true },
  unlock: { key: "u", display: "Alt+U", aria: "Alt+U", alt: true },
  metadata: { key: "d", display: "Alt+D", aria: "Alt+D", alt: true },
};

export const appShortcuts = {
  chooseFiles: { key: "o", display: "Ctrl+O", aria: "Control+O", controlOrMeta: true },
  settings: { key: ",", display: "Ctrl+,", aria: "Control+,", controlOrMeta: true },
  run: { key: "Enter", display: "Ctrl+Enter", aria: "Control+Enter", controlOrMeta: true },
} satisfies Record<string, KeyboardShortcut>;

export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const controlMatches = shortcut.controlOrMeta ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
  return keyMatches && controlMatches && event.altKey === Boolean(shortcut.alt) && !event.shiftKey;
}

export function toolForShortcut(event: KeyboardEvent): ToolId | undefined {
  return (Object.entries(toolShortcuts) as Array<[ToolId, KeyboardShortcut]>).find(([, shortcut]) => matchesShortcut(event, shortcut))?.[0];
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}
