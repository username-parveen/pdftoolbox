import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type DragPayload =
  | { type: "enter"; paths: string[] }
  | { type: "over" }
  | { type: "drop"; paths: string[] }
  | { type: "leave" };

const mocks = vi.hoisted(() => ({
  dragHandler: undefined as undefined | ((event: { payload: DragPayload }) => void),
  jobHandler: undefined as undefined | ((event: { payload: unknown }) => void),
  capabilities: vi.fn(),
  defaultOutputDirectory: vi.fn(),
  prepareOutputDirectory: vi.fn(),
  startJob: vi.fn(),
  revealJobOutput: vi.fn(),
  openJobOutput: vi.fn(),
  cancelJob: vi.fn(),
  basename: vi.fn(),
  dirname: vi.fn(),
  openDialog: vi.fn(),
  saveDialog: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event: string, handler: (event: { payload: unknown }) => void) => {
    mocks.jobHandler = handler;
    return vi.fn();
  }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: (event: { payload: DragPayload }) => void) => {
      mocks.dragHandler = handler;
      return vi.fn();
    },
  }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  basename: mocks.basename,
  join: async (directory: string, name: string) => `${directory}\\${name}`,
  dirname: mocks.dirname,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.openDialog, save: mocks.saveDialog }));

vi.mock("./lib/backend", () => ({
  backend: {
    capabilities: mocks.capabilities,
    defaultOutputDirectory: mocks.defaultOutputDirectory,
    prepareOutputDirectory: mocks.prepareOutputDirectory,
    startJob: mocks.startJob,
    revealJobOutput: mocks.revealJobOutput,
    openJobOutput: mocks.openJobOutput,
    cancelJob: mocks.cancelJob,
  },
}));

import App from "./App";
import { SAVE_PREFERENCES_STORAGE_KEY, serializeSavePreferences } from "./lib/savePreferences";
import { APPEARANCE_STORAGE_KEY } from "./lib/appearance";

describe("production App presentation wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dragHandler = undefined;
    mocks.jobHandler = undefined;
    mocks.capabilities.mockResolvedValue({ qpdf: true, qpdfVersion: "12.4.0", pdfium: true, elevated: false });
    mocks.defaultOutputDirectory.mockResolvedValue("C:\\Downloads\\PDF Toolbox");
    mocks.prepareOutputDirectory.mockImplementation(async (path: string) => path);
    mocks.startJob.mockResolvedValue({ id: "job-1", tool: "Merge PDFs", state: "queued", currentStep: 0, totalSteps: 3, message: "Waiting", outputPaths: [] });
    mocks.revealJobOutput.mockResolvedValue(undefined);
    mocks.openJobOutput.mockResolvedValue(undefined);
    mocks.cancelJob.mockResolvedValue(undefined);
    mocks.basename.mockImplementation(async (path: string) => path.split(/[\\/]/).at(-1) ?? path);
    mocks.dirname.mockImplementation(async (path: string) => path.replace(/[\\/][^\\/]+$/, ""));
    mocks.openDialog.mockResolvedValue(null);
    mocks.saveDialog.mockResolvedValue(null);
    mocks.writeText.mockResolvedValue(undefined);
    window.localStorage.clear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.writeText } });
  });

  it("starts with Merge PDFs selected", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Merge PDFs", current: "page" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Merge PDFs" })).toBeTruthy();
  });

  it("maps the Tauri drag lifecycle to stable shared drop states and keeps the partial-drop summary", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(mocks.dragHandler).toBeTypeOf("function"));

    act(() => mocks.dragHandler!({ payload: { type: "over" } }));
    expect(container.querySelector('[data-drop-state="entering"]')).toBeTruthy();
    act(() => mocks.dragHandler!({ payload: { type: "enter", paths: ["C:\\Documents\\first.pdf"] } }));
    expect(container.querySelector('[data-drop-state="valid"]')).toBeTruthy();
    act(() => mocks.dragHandler!({ payload: { type: "leave" } }));
    expect(container.querySelector('[data-drop-state="idle"]')).toBeTruthy();

    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\notes.txt"] } }));
    expect(container.querySelector('[data-drop-state="rejected"]')).toBeTruthy();
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-drop-state="rejected"]')).toBeTruthy();

    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\first.pdf", "C:\\Documents\\second.pdf", "C:\\Documents\\notes.txt"] } }));
    expect(container.querySelector(".drop-feedback.drop-accepted")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Added 2 files. Skipped 1 unsupported or extra file.");
    await act(async () => Promise.resolve());
    expect(container.querySelector(".drop-feedback.drop-accepted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));
    expect(container.querySelector('[data-drop-state="idle"]')).toBeTruthy();
  });

  it("does not blame the destination for a structured non-destination start failure", async () => {
    mocks.startJob.mockRejectedValueOnce({ kind: "pdfCorrupt", message: "The selected PDF is malformed." });
    render(<App />);
    await waitFor(() => expect(mocks.dragHandler).toBeTypeOf("function"));
    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\first.pdf", "C:\\Documents\\second.pdf"] } }));
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1)!);

    expect(await screen.findByText("PDF Toolbox could not start the operation. The selected PDF is malformed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose another folder" })).toBeNull();
  });

  it("does not let the start response overwrite a faster completed event", async () => {
    let resolveStart!: (job: { id: string; tool: string; state: "queued"; currentStep: number; totalSteps: number; message: string; outputPaths: string[] }) => void;
    mocks.startJob.mockImplementationOnce(() => new Promise((resolve) => { resolveStart = resolve; }));
    render(<App />);
    await waitFor(() => expect(mocks.dragHandler).toBeTypeOf("function"));
    await waitFor(() => expect(mocks.jobHandler).toBeTypeOf("function"));
    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\first.pdf", "C:\\Documents\\second.pdf"] } }));
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1)!);
    await waitFor(() => expect(mocks.startJob).toHaveBeenCalledOnce());

    act(() => mocks.jobHandler!({ payload: { id: "job-1", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Output saved", outputPaths: ["C:\\out\\merged.pdf"] } }));
    await act(async () => resolveStart({ id: "job-1", tool: "Merge PDFs", state: "queued", currentStep: 0, totalSteps: 3, message: "Waiting", outputPaths: [] }));

    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.queryByText("Waiting")).toBeNull();
  });

  it("does not reuse a stale automatic destination while a new source name resolves", async () => {
    let resolveBasename!: (name: string) => void;
    render(<App />);
    await waitFor(() => expect(mocks.dragHandler).toBeTypeOf("function"));
    mocks.basename.mockImplementationOnce(() => new Promise((resolve) => { resolveBasename = resolve; }));

    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\first.pdf", "C:\\Documents\\second.pdf"] } }));

    expect((screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("C:\\Downloads\\PDF Toolbox\\merged.pdf")).toBeNull();
    await act(async () => resolveBasename("first.pdf"));
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("C:\\Downloads\\PDF Toolbox\\first_merged.pdf")).toBeNull();
  });

  it("uses dirname for multi-output copy while keeping reveal authorized by the first output", async () => {
    render(<App />);
    await waitFor(() => expect(mocks.jobHandler).toBeTypeOf("function"));
    act(() => mocks.jobHandler!({ payload: { id: "job-1", tool: "Split PDF", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved", outputPaths: ["C:\\out\\one.pdf", "C:\\out\\two.pdf"] } }));

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(mocks.revealJobOutput).toHaveBeenCalledWith("job-1", "C:\\out\\one.pdf");
    fireEvent.click(screen.getByText("More"));
    fireEvent.click(screen.getByRole("button", { name: "Copy folder path" }));
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith("C:\\out"));
    expect(mocks.dirname).toHaveBeenCalledWith("C:\\out\\one.pdf");
    expect(screen.getByText("Folder path copied.")).toBeTruthy();
  });

  it("automatically reveals each completed job once without repeating on updates or rerenders", async () => {
    window.localStorage.setItem(SAVE_PREFERENCES_STORAGE_KEY, serializeSavePreferences({
      defaultDirectory: "C:\\Downloads\\PDF Toolbox",
      askEveryTime: false,
      openFolderAfterCompletion: true,
      rememberToolSettings: true,
    }));
    const { rerender } = render(<App />);
    await waitFor(() => expect(mocks.jobHandler).toBeTypeOf("function"));

    act(() => mocks.jobHandler!({ payload: { id: "job-1", tool: "Merge PDFs", state: "running", currentStep: 2, totalSteps: 3, message: "Merging", outputPaths: ["C:\\out\\partial.pdf"] } }));
    expect(mocks.revealJobOutput).not.toHaveBeenCalled();

    act(() => mocks.jobHandler!({ payload: { id: "job-1", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved", outputPaths: ["C:\\out\\one.pdf"] } }));
    expect(mocks.revealJobOutput).toHaveBeenCalledTimes(1);
    expect(mocks.revealJobOutput).toHaveBeenLastCalledWith("job-1", "C:\\out\\one.pdf");

    rerender(<App />);
    act(() => mocks.jobHandler!({ payload: { id: "job-1", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved again", outputPaths: ["C:\\out\\one.pdf"] } }));
    expect(mocks.revealJobOutput).toHaveBeenCalledTimes(1);

    act(() => mocks.jobHandler!({ payload: { id: "job-2", tool: "Split PDF", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved", outputPaths: ["C:\\out\\two.pdf"] } }));
    expect(mocks.revealJobOutput).toHaveBeenCalledTimes(2);
    expect(mocks.revealJobOutput).toHaveBeenLastCalledWith("job-2", "C:\\out\\two.pdf");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const autoReveal = screen.getByRole("switch", { name: "Open folder after completion" }) as HTMLInputElement;
    expect(autoReveal.checked).toBe(true);
    fireEvent.click(autoReveal);
    act(() => mocks.jobHandler!({ payload: { id: "job-3", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved", outputPaths: ["C:\\out\\three.pdf"] } }));
    expect(mocks.revealJobOutput).toHaveBeenCalledTimes(2);
  });

  it("remembers Options expansion per tool for the current production session", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(mocks.dragHandler).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Convert PDF to images" }));
    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\first.pdf"] } }));
    let details = container.querySelector("details.options-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    details.open = true;
    fireEvent(details, new Event("toggle"));

    fireEvent.click(screen.getByRole("button", { name: "Rotate pages" }));
    act(() => mocks.dragHandler!({ payload: { type: "drop", paths: ["C:\\Documents\\second.pdf"] } }));
    details = container.querySelector("details.options-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Convert PDF to images" }));
    expect((container.querySelector("details.options-disclosure") as HTMLDetailsElement).open).toBe(true);
  });

  it("persists appearance immediately without changing save preferences", async () => {
    const saved = serializeSavePreferences({
      defaultDirectory: "C:\\Downloads\\PDF Toolbox",
      askEveryTime: false,
      openFolderAfterCompletion: false,
      rememberToolSettings: true,
    });
    window.localStorage.setItem(SAVE_PREFERENCES_STORAGE_KEY, saved);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({ version: 1, theme: "dark", palette: "olive" });
    expect(window.localStorage.getItem(SAVE_PREFERENCES_STORAGE_KEY)).toBe(saved);

    fireEvent.click(screen.getByRole("button", { name: "Reset appearance" }));
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(SAVE_PREFERENCES_STORAGE_KEY)).toBe(saved);
  });

  it("loads invalid appearance storage as defaults", () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 1, theme: "sepia", palette: "gold" }));
    const { container } = render(<App />);
    expect(container.querySelector(".app-shell")?.getAttribute("data-palette")).toBe("olive");
    expect(container.querySelector(".app-shell")?.getAttribute("data-theme")).toBe("light");
  });
});
