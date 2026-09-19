import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PdfToolboxViewProps } from "../types/presentation";
import { toolDefinitions } from "../lib/tools";
import { PdfToolboxView } from "./PdfToolboxView";
import { actionLabel } from "./Workspace";

function createProps(overrides: Partial<PdfToolboxViewProps> = {}): PdfToolboxViewProps {
  return {
    active: "merge",
    files: ["C:\\Documents\\first.pdf", "C:\\Documents\\second.pdf"],
    options: { pages: "", rotation: 90, password: "", splitEvery: 1, imageFormat: "png", dpi: 96 },
    busy: false,
    capabilities: { qpdf: true, qpdfVersion: "12.4.0", pdfium: true, elevated: false },
    toasts: [],
    appearance: { theme: "system", palette: "olive" },
    resolvedTheme: "light",
    preferences: { defaultDirectory: "C:\\Downloads\\PDF Toolbox", askEveryTime: false, openFolderAfterCompletion: false, rememberToolSettings: true },
    preferencesReady: true,
    destination: "C:\\Downloads\\PDF Toolbox\\first_merged.pdf",
    settingsOpen: false,
    dropState: "idle",
    optionsExpanded: false,
    onSelectTool: vi.fn(),
    onChooseFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    onRemoveAllFiles: vi.fn(),
    onMoveFile: vi.fn(),
    onOptionsChange: vi.fn(),
    onOptionsExpandedChange: vi.fn(),
    onRun: vi.fn(),
    onCancelJob: vi.fn(),
    onDismissJob: vi.fn(),
    onDismissBanner: vi.fn(),
    onBannerAction: vi.fn(),
    onDismissToast: vi.fn(),
    onAppearanceChange: vi.fn(),
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    onPreferencesChange: vi.fn(),
    onChooseDefaultDirectory: vi.fn(),
    onOpenOutput: vi.fn(),
    onRevealOutput: vi.fn(),
    onCopyOutputPath: vi.fn(),
    onRunAgain: vi.fn(),
    ...overrides,
  };
}

describe("PdfToolboxView", () => {
  it("uses a two-row content layout with no context bar", () => {
    const { container } = render(<PdfToolboxView {...createProps()} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "PDF tools" }).querySelectorAll("button")).toHaveLength(12);
    expect(screen.queryByRole("list", { name: "Workflow stages" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Output" })).toBeNull();
    expect(screen.queryByText("Organize", { selector: ".category-label" })).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(container.querySelector(".context-bar")).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" }).closest(".sidebar-footer")).toBeTruthy();
    expect(screen.getByRole("main").querySelectorAll(":scope > header, :scope > .task-content")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Input" })).toBeTruthy();
    expect(screen.queryByText("Local document utility")).toBeNull();
  });

  it.each([
    ["light", "olive"], ["light", "graphite"], ["light", "blue"], ["light", "terracotta"],
    ["dark", "olive"], ["dark", "graphite"], ["dark", "blue"], ["dark", "terracotta"],
  ] as const)("sets %s and %s presentation on the shared app shell", (resolvedTheme, palette) => {
    const { container } = render(<PdfToolboxView {...createProps({ resolvedTheme, appearance: { theme: resolvedTheme, palette } })} />);
    expect(container.querySelector(".app-shell")?.getAttribute("data-theme")).toBe(resolvedTheme);
    expect(container.querySelector(".app-shell")?.getAttribute("data-palette")).toBe(palette);
  });

  it("keeps privacy concise and moves engine details into Settings diagnostics", () => {
    render(<PdfToolboxView {...createProps({ settingsOpen: true })} />);
    const availability = screen.getByRole("status", { name: "Privacy" });
    expect(availability.textContent).toBe("Private & offline");
    expect(screen.getAllByText(/qpdf|PDFium/)).toHaveLength(2);
    expect(screen.getByText("qpdf: Ready (12.4.0)").closest("details")).toBeTruthy();
  });

  it("uses user-facing tool names and direct action labels", () => {
    const props = createProps();
    render(<PdfToolboxView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Convert PDF to images" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(props.onSelectTool).toHaveBeenCalledWith("pdfToImages");
    expect(props.onRun).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
  });

  it("documents tool shortcuts in accessible rich tooltips", () => {
    render(<PdfToolboxView {...createProps()} />);
    const merge = screen.getAllByRole("button", { name: "Merge PDFs" })[0];

    expect(merge.getAttribute("aria-keyshortcuts")).toBe("Alt+M");
    fireEvent.focus(merge);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Merge PDFs");
    expect(tooltip.textContent).toContain("Combine documents in order");
    expect(tooltip.textContent).toContain("Alt+M");
    expect(document.querySelector(".m3-rich-tooltip")).toBeTruthy();
  });

  it("handles tool and application keyboard shortcuts outside editable controls", () => {
    const props = createProps({ active: "rotate" });
    render(<PdfToolboxView {...props} />);

    fireEvent.keyDown(window, { key: "m", altKey: true });
    fireEvent.keyDown(window, { key: "o", ctrlKey: true });
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    expect(props.onSelectTool).toHaveBeenCalledWith("merge");
    expect(props.onChooseFiles).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
    expect(props.onRun).toHaveBeenCalledOnce();

    const pages = screen.getByLabelText("Pages (optional)");
    fireEvent.keyDown(pages, { key: "m", altKey: true });
    expect(props.onSelectTool).toHaveBeenCalledOnce();
  });

  it("does not bypass disabled actions through keyboard shortcuts", () => {
    const props = createProps({ files: [] });
    render(<PdfToolboxView {...props} />);

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    expect(props.onRun).not.toHaveBeenCalled();
  });

  it("uses direct verbs for every primary action", () => {
    expect(Object.fromEntries(toolDefinitions.map((tool) => [tool.id, actionLabel(tool)]))).toEqual({
      imagesToPdf: "Create PDF",
      pdfToImages: "Convert pages",
      merge: "Merge PDFs",
      extract: "Extract pages",
      remove: "Remove pages",
      reorder: "Arrange pages",
      rotate: "Rotate pages",
      split: "Split PDF",
      compress: "Compress PDF",
      protect: "Add password",
      unlock: "Remove password",
      metadata: "Remove document details",
    });
  });

  it("shows the default folder rather than the predicted output and wires Change", () => {
    const props = createProps();
    render(<PdfToolboxView {...props} />);
    expect(screen.getByText("C:\\Downloads\\PDF Toolbox")).toBeTruthy();
    expect(screen.queryByText("C:\\Downloads\\PDF Toolbox\\first_merged.pdf")).toBeNull();
    expect(screen.getByText("Saves to")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(props.onChooseDefaultDirectory).toHaveBeenCalledOnce();
  });

  it("shows ask-every-time without destination chooser language in the primary action", () => {
    render(<PdfToolboxView {...createProps({ preferences: { ...createProps().preferences, askEveryTime: true } })} />);
    expect(screen.getByText("Ask where to save")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Merge PDFs" }).at(-1)).toBeTruthy();
    expect(screen.queryByText(/Choose output/)).toBeNull();
  });

  it("explains empty input with concise recovery copy", () => {
    render(<PdfToolboxView {...createProps({ files: [] })} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Merge PDFs" })).toHaveLength(1);
    expect(screen.getByText("Add two PDFs to merge", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByText(/PDF Toolbox\\first_merged/)).toBeNull();
  });

  it("prioritizes filenames, shows parent folders, keeps accessible full paths, and supports reorder", () => {
    const props = createProps();
    render(<PdfToolboxView {...props} />);
    const list = screen.getByRole("list", { name: "Files in processing order" });
    expect(list.querySelector("li:first-child strong")?.textContent).toBe("first.pdf");
    expect(list.querySelector("li:first-child small")?.textContent).toBe("Documents");
    expect(list.querySelector("li:first-child .visually-hidden")?.textContent).toContain("C:\\Documents\\first.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Move first.pdf down" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));
    expect(props.onMoveFile).toHaveBeenCalledWith(0, 1);
    expect(props.onRemoveAllFiles).toHaveBeenCalledOnce();
  });

  it("uses the POSIX parent folder and a single-file row without an order number", () => {
    const { container } = render(<PdfToolboxView {...createProps({ active: "pdfToImages", files: ["/home/demo/reports/first.pdf"] })} />);
    expect(screen.getByText("reports", { selector: "small" })).toBeTruthy();
    expect(container.querySelector(".file-row-single")).toBeTruthy();
    expect(container.querySelector(".order-number")).toBeNull();
  });

  it("preserves Windows and POSIX root folder names and accessible full paths", () => {
    const { container } = render(<PdfToolboxView {...createProps({ files: ["C:\\first.pdf", "/second.pdf"] })} />);
    const rows = container.querySelectorAll(".file-row");
    expect(rows[0].querySelector("small")?.textContent).toBe("C:\\");
    expect(rows[1].querySelector("small")?.textContent).toBe("/");
    expect(rows[0].querySelector(".visually-hidden")?.textContent).toContain("C:\\first.pdf");
    expect(rows[1].querySelector(".visually-hidden")?.textContent).toContain("/second.pdf");
  });

  it("uses short visible empty-drop guidance while retaining detailed accessible formats", () => {
    const { rerender } = render(<PdfToolboxView {...createProps({ active: "merge", files: [] })} />);
    expect(screen.getByText("Drop PDF here")).toBeTruthy();
    expect(screen.getByText("or choose files")).toBeTruthy();
    expect(screen.getByText("PDF · Two or more")).toBeTruthy();
    expect(screen.getByLabelText(/PDF documents/)).toBeTruthy();

    rerender(<PdfToolboxView {...createProps({ active: "imagesToPdf", files: [] })} />);
    expect(screen.getByText("Drop images here")).toBeTruthy();
    expect(screen.getByText("Common image formats · One or more")).toBeTruthy();
  });

  it.each(["entering", "valid", "invalid", "accepted", "rejected", "elevated"] as const)("renders the %s drag state explicitly", (dropState) => {
    const { container } = render(<PdfToolboxView {...createProps({ files: [], dropState })} />);
    expect(container.querySelector(`[data-drop-state="${dropState}"]`)).toBeTruthy();
  });

  it("presents image quality as Standard, High, and Print with DPI secondary text", () => {
    const props = createProps({ active: "pdfToImages", files: ["C:\\Documents\\first.pdf"], optionsExpanded: true });
    render(<PdfToolboxView {...props} />);
    expect(screen.getByRole("group", { name: "Quality" }).textContent).toContain("Standard96 DPIHigh144 DPIPrint300 DPI");
    fireEvent.click(screen.getByRole("radio", { name: /Print/ }));
    expect(props.onOptionsChange).toHaveBeenCalledWith(expect.objectContaining({ dpi: 300 }));
  });

  it("renders optional options after input as a collapsed semantic details disclosure", () => {
    const { container } = render(<PdfToolboxView {...createProps({ active: "pdfToImages", files: ["C:\\Documents\\first.pdf"] })} />);
    const details = container.querySelector("details.options-disclosure") as HTMLDetailsElement;
    const section = details.closest("section") as HTMLElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    expect(details.querySelector(":scope > summary")?.textContent).toContain("OptionsPNG · Standard · All pages");
    expect(details.querySelector("summary h2")).toBeNull();
    expect(section.getAttribute("aria-labelledby")).toBe("tool-options-title");
    expect(section.getAttribute("aria-label")).toBeNull();
    expect(container.querySelector("#tool-options-title")?.textContent).toBe("Options");
    expect(screen.getByText("Format")).toBeTruthy();
  });

  it("reports native disclosure toggles and supports keyboard activation through summary semantics", () => {
    const props = createProps({ active: "pdfToImages", files: ["C:\\Documents\\first.pdf"] });
    const { container } = render(<PdfToolboxView {...props} />);
    const details = container.querySelector("details.options-disclosure") as HTMLDetailsElement;
    const summary = details.querySelector("summary") as HTMLElement;
    expect(summary.tabIndex).toBe(0);
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(props.onOptionsExpandedChange).toHaveBeenCalledWith(true);
  });

  it.each([
    ["extract", "Pages to extract"],
    ["reorder", "Page order"],
    ["protect", "New password"],
    ["unlock", "Current password"],
  ] as const)("keeps required %s controls visible after input without a disclosure", (active, label) => {
    const { container } = render(<PdfToolboxView {...createProps({ active, files: ["C:\\Documents\\first.pdf"] })} />);
    expect(screen.getByRole("heading", { level: 2, name: "Options" })).toBeTruthy();
    expect((screen.getByLabelText(label) as HTMLInputElement).required).toBe(true);
    expect(container.querySelector("details.options-disclosure")).toBeNull();
  });

  it.each(toolDefinitions.map((tool) => tool.id))("hides the entire Options section before input for %s", (active) => {
    const { container } = render(<PdfToolboxView {...createProps({ active, files: [] })} />);
    expect(container.querySelector(".options-section")).toBeNull();
  });

  it.each(["imagesToPdf", "merge", "compress", "metadata"] as const)("renders no Options section for %s", (active) => {
    render(<PdfToolboxView {...createProps({ active, files: [] })} />);
    expect(screen.queryByRole("heading", { level: 2, name: "Options" })).toBeNull();
    expect(document.querySelector("details.options-disclosure")).toBeNull();
  });

  it("forces optional options open when a hidden field has a validation error", () => {
    const props = createProps({ active: "pdfToImages", files: ["C:\\Documents\\first.pdf"], validation: { pages: "Enter pages like 1-5, 8." } });
    const { container } = render(<PdfToolboxView {...props} />);
    const details = container.querySelector("details.options-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Enter pages");

    details.open = false;
    fireEvent(details, new Event("toggle"));

    expect(details.open).toBe(true);
    expect(screen.getByLabelText("Pages (optional)")).toBeTruthy();
    expect(props.onOptionsExpandedChange).not.toHaveBeenCalled();
  });

  it("does not offer reset when Pages contains only whitespace", () => {
    render(<PdfToolboxView {...createProps({ active: "pdfToImages", files: ["C:\\Documents\\first.pdf"], optionsExpanded: true, options: { ...createProps().options, pages: "   " } })} />);
    expect(screen.queryByRole("button", { name: "Reset to defaults" })).toBeNull();
  });

  it("shows and applies a contextual reset without clearing unrelated safe draft values", () => {
    const props = createProps({
      active: "pdfToImages",
      files: ["C:\\Documents\\first.pdf"],
      optionsExpanded: true,
      options: { ...createProps().options, imageFormat: "webp", dpi: 300, pages: "2-4", rotation: 270, splitEvery: 5 },
    });
    render(<PdfToolboxView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(props.onOptionsChange).toHaveBeenCalledWith({ ...props.options, imageFormat: "png", dpi: 96, pages: "", password: "" });
  });

  it("renders all save settings, read-only auto rename, and collapsed diagnostics", () => {
    const props = createProps({ settingsOpen: true });
    render(<PdfToolboxView {...props} />);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change folder" })).toBeTruthy();
    const switchNames = ["Ask where to save each time", "Open folder after completion", "Remember tool settings"];
    const switches = switchNames.map((name) => screen.getByRole("switch", { name: new RegExp(name) }) as HTMLInputElement);
    switches.forEach((control, index) => {
      expect(control.type).toBe("checkbox");
      expect(control.getAttribute("role")).toBe("switch");
      expect(control.labels).toHaveLength(1);
      expect(control.labels?.[0]?.textContent).toContain(switchNames[index]);
    });
    expect(screen.getByText("Auto rename")).toBeTruthy();
    expect(screen.getByText("About & diagnostics")).toBeTruthy();
    expect(screen.getByText("qpdf: Ready (12.4.0)")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Color" })).toBeTruthy();
    fireEvent.click(switches[0]);
    expect(props.onPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({ askEveryTime: true }));
  });

  it("presents accessible appearance controls before Files and resets only changed appearance", () => {
    const props = createProps({ settingsOpen: true });
    const { rerender } = render(<PdfToolboxView {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog.querySelectorAll("h3")[0].textContent).toBe("Appearance");
    expect(dialog.querySelectorAll("h3")[1].textContent).toBe("Files");
    expect((screen.getByRole("radio", { name: "System" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Olive/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("button", { name: "Reset appearance" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(props.onAppearanceChange).toHaveBeenCalledWith({ theme: "dark", palette: "olive" });
    rerender(<PdfToolboxView {...props} appearance={{ theme: "dark", palette: "blue" }} />);
    expect(screen.getByText("Selected", { selector: ".palette-selected" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset appearance" }));
    expect(props.onAppearanceChange).toHaveBeenLastCalledWith({ theme: "system", palette: "olive" });
  });

  it("labels the settings dialog, traps focus, closes on Escape, and restores the trigger", () => {
    function SettingsHarness() {
      const [open, setOpen] = useState(false);
      return <PdfToolboxView {...createProps({ settingsOpen: open, onOpenSettings: () => setOpen(true), onCloseSettings: () => setOpen(false) })} />;
    }

    render(<SettingsHarness />);
    const trigger = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Settings", description: "Customize appearance and choose where completed files go." });
    const close = screen.getByRole("button", { name: "Close settings" });
    const diagnostics = dialog.querySelector("summary") as HTMLElement;
     expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    let focusBeforeSummary = document.activeElement;
    while (focusBeforeSummary && focusBeforeSummary !== diagnostics) {
      fireEvent.keyDown(focusBeforeSummary!, { key: "Tab", shiftKey: true });
      focusBeforeSummary = document.activeElement;
    }
     expect(document.activeElement).toBe(diagnostics);
    fireEvent.keyDown(diagnostics, { key: "Tab" });
    let focusAfterSummary = document.activeElement;
    while (focusAfterSummary && focusAfterSummary !== close) {
      fireEvent.keyDown(focusAfterSummary!, { key: "Tab" });
      focusAfterSummary = document.activeElement;
    }
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("does not expose or persist a tool password through Settings", () => {
    const props = createProps({
      active: "protect",
      files: ["C:\\Documents\\first.pdf"],
      options: { ...createProps().options, password: "do-not-persist" },
      settingsOpen: true,
    });
    render(<PdfToolboxView {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog.querySelector('input[type="password"]')).toBeNull();
    expect(dialog.textContent).not.toContain("do-not-persist");
    fireEvent.click(screen.getByRole("switch", { name: /Remember tool settings/ }));
    expect(props.onPreferencesChange).toHaveBeenCalledWith({
      defaultDirectory: "C:\\Downloads\\PDF Toolbox",
      askEveryTime: false,
      openFolderAfterCompletion: false,
      rememberToolSettings: false,
    });
    expect(vi.mocked(props.onPreferencesChange).mock.calls[0][0]).not.toHaveProperty("password");
  });

  it.each([
    undefined,
    { qpdf: true, qpdfVersion: "12.4.0", pdfium: true, elevated: false },
    { qpdf: false, pdfium: true, elevated: false },
  ] as const)("keeps persistent privacy copy stable across engine states", (capabilities) => {
    render(<PdfToolboxView {...createProps({ capabilities })} />);
    const availability = screen.getByRole("status", { name: "Privacy" });
    expect(availability.textContent).toBe("Private & offline");
    expect(availability.textContent).not.toMatch(/qpdf|pdfium/i);
  });

  it("wires action-oriented banner recovery", () => {
    const props = createProps({ banner: { kind: "error", message: "The folder is unavailable.", actionLabel: "Choose another folder" } });
    render(<PdfToolboxView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose another folder" }));
    expect(props.onBannerAction).toHaveBeenCalledOnce();
  });

  it("shows queued and running progress with accessible cancellation", () => {
    const props = createProps({ activeJob: { id: "job-1", tool: "Merge PDFs", state: "queued", currentStep: 0, totalSteps: 3, message: "Waiting", outputPaths: [] } });
    const { rerender } = render(<PdfToolboxView {...props} />);
    expect(screen.getByText("Waiting to start")).toBeTruthy();
    expect(screen.queryByText("Waiting")).toBeNull();
    expect((screen.getByRole("progressbar") as HTMLElement).getAttribute("aria-valuenow")).toBe("0");
    rerender(<PdfToolboxView {...props} activeJob={{ ...props.activeJob!, state: "running", currentStep: 1 }} />);
    expect(screen.getByText("Working… 1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancelJob).toHaveBeenCalledWith("job-1");
  });

  it("uses concise preparation and failure copy with explicit state classes", () => {
    const { container, rerender } = render(<PdfToolboxView {...createProps({ busy: true })} />);
    expect(screen.getAllByText("Getting ready").length).toBeGreaterThan(0);
    expect(container.querySelector(".primary-action.is-loading")).toBeTruthy();

    rerender(<PdfToolboxView {...createProps({ preferencesReady: false, destination: undefined })} />);
    expect(screen.getByText("Preparing save folder", { selector: "strong" })).toBeTruthy();

    rerender(<PdfToolboxView {...createProps({ activeJob: { id: "job-1", tool: "Merge PDFs", state: "failed", currentStep: 0, totalSteps: 3, message: "Processing failed", error: "The PDF could not be read.", outputPaths: [] } })} />);
    expect(container.querySelector(".action-shelf.job-failed")).toBeTruthy();
    expect(screen.getByText("Couldn’t start")).toBeTruthy();
    expect(screen.getByText("Check the issue, then try again")).toBeTruthy();
    expect(screen.queryByText(/input and settings are still here/i)).toBeNull();
  });

  it("keeps a single-output completion shelf with destination and result actions", () => {
    const props = createProps({ activeJob: { id: "job-1", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Output saved", outputPaths: ["C:\\Documents\\merged.pdf"] } });
    render(<PdfToolboxView {...props} />);
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("merged.pdf")).toBeTruthy();
    expect(screen.getAllByText("Documents").length).toBeGreaterThan(0);
    for (const name of ["Open", "Show in folder", "Done"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    const more = screen.getByText("More").closest("details")!;
    expect(more.querySelectorAll("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Show in folder" }));
    fireEvent.click(screen.getByText("More"));
    fireEvent.click(screen.getByRole("button", { name: "Copy path" }));
    expect(props.onOpenOutput).toHaveBeenCalledWith("job-1", "C:\\Documents\\merged.pdf");
    expect(props.onRevealOutput).toHaveBeenCalledWith("job-1", "C:\\Documents\\merged.pdf");
    expect(props.onCopyOutputPath).toHaveBeenCalledWith("C:\\Documents\\merged.pdf", "file");
  });

  it("closes the completion More disclosure with Escape and restores summary focus", () => {
    const props = createProps({ activeJob: { id: "job-1", tool: "Merge PDFs", state: "completed", currentStep: 3, totalSteps: 3, message: "Output saved", outputPaths: ["C:\\Documents\\merged.pdf"] } });
    render(<PdfToolboxView {...props} />);
    const summary = screen.getByText("More");
    const details = summary.closest("details") as HTMLDetailsElement;
    fireEvent.click(summary);
    const copyPath = screen.getByRole("button", { name: "Copy path" });
    copyPath.focus();
    fireEvent.keyDown(copyPath, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(props.onCopyOutputPath).not.toHaveBeenCalled();
  });

  it("uses the first authorization path for multiple results and does not offer Open file", () => {
    const props = createProps({ activeJob: { id: "job-1", tool: "Split PDF", state: "completed", currentStep: 3, totalSteps: 3, message: "Saved", outputPaths: ["C:\\out\\one.pdf", "C:\\out\\two.pdf"] } });
    render(<PdfToolboxView {...props} />);
    expect(screen.getByText("2 files saved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    expect(screen.getByText("out")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    fireEvent.click(screen.getByText("More"));
    fireEvent.click(screen.getByRole("button", { name: "Copy folder path" }));
    expect(props.onRevealOutput).toHaveBeenCalledWith("job-1", "C:\\out\\one.pdf");
    expect(props.onCopyOutputPath).toHaveBeenCalledWith("C:\\out\\one.pdf", "folder");
  });
});
