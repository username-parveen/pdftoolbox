import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const productStyles = readFileSync("src/styles.css", "utf8");

describe("frontend styles", () => {
  it("keeps every visible pixel font size at 12px or larger", () => {
    for (const match of productStyles.matchAll(/([^{}]+)\{([^{}]*font-size:\s*([\d.]+)px[^{}]*)\}/g)) {
      const [, selector, , size] = match;
      if (selector.includes("visually-hidden")) continue;
      expect(Number(size), selector.trim()).toBeGreaterThanOrEqual(12);
    }
  });

  it("does not retain selectors for removed workflow stages or output intent", () => {
    expect(productStyles).not.toMatch(/\.workflow-stages|\.stage-number|\.stage-label|\.output-intent|\.context-bar|--context-height/);
  });

  it("keeps desktop controls at least 36px and keyboard focus rings at 3px", () => {
    expect(productStyles).toContain("--control-min: 36px");
    expect(productStyles).toMatch(/:focus-visible[^{}]*\{[^{}]*outline:\s*3px solid var\(--focus-ring\)/);
    expect(productStyles).not.toMatch(/min-height:\s*32px/);
  });

  it("uses Material 3 switch track and handle geometry without shrinking the labeled target", () => {
    expect(productStyles).toMatch(/\.switch-row\s*\{[^{}]*min-height:\s*56px/);
    expect(productStyles).toMatch(/\.switch-row input\s*\{[^{}]*width:\s*52px;[^{}]*height:\s*32px;[^{}]*border:\s*2px solid var\(--outline\);[^{}]*border-radius:\s*16px/);
    expect(productStyles).toMatch(/\.switch-row input::before\s*\{[^{}]*top:\s*8px;[^{}]*left:\s*8px;[^{}]*width:\s*16px;[^{}]*height:\s*16px/);
    expect(productStyles).toMatch(/\.switch-row input:checked::before\s*\{[^{}]*top:\s*4px;[^{}]*left:\s*24px;[^{}]*width:\s*24px;[^{}]*height:\s*24px/);
    expect(productStyles).not.toMatch(/\.switch-row input[^{}]*width:\s*44px|\.switch-row input:checked::before[^{}]*translateX/);
  });

  it("defines switch focus, pointer states, explicit disabled colors, and motion safeguards", () => {
    expect(productStyles).toMatch(/\.switch-row input:focus-visible\s*\{[^{}]*outline:\s*3px solid var\(--focus-ring\)/);
    expect(productStyles).toContain(".switch-row input:hover:not(:disabled)");
    expect(productStyles).toMatch(/\.switch-row input:active:not\(:disabled\)::before\s*\{[^{}]*width:\s*28px;[^{}]*height:\s*28px/);
    expect(productStyles).toMatch(/\.switch-row input:disabled\s*\{[^{}]*border-color:\s*var\(--disabled-text\)[^{}]*background:\s*var\(--surface\)/);
    expect(productStyles).toMatch(/\.switch-row input:checked:disabled\s*\{[^{}]*border-color:\s*var\(--disabled-text\)[^{}]*background:\s*var\(--disabled-text\)/);
    expect(productStyles).toMatch(/\.switch-row input:checked:disabled::before\s*\{[^{}]*background:\s*var\(--surface\)/);
    expect(productStyles).not.toMatch(/\.switch-row input:disabled\s*\{[^{}]*opacity:/);
    expect(productStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*\.01ms !important/);
  });

  it("uses explicit system-color switch states in forced colors", () => {
    const forcedColors = productStyles.slice(productStyles.indexOf("@media (forced-colors: active)"));
    expect(forcedColors).toMatch(/\.switch-row input\s*\{[^{}]*forced-color-adjust:\s*none;[^{}]*border-color:\s*CanvasText;[^{}]*background:\s*Canvas/);
    expect(forcedColors).toMatch(/\.switch-row input::before\s*\{[^{}]*background:\s*CanvasText/);
    expect(forcedColors).toMatch(/\.switch-row input:checked\s*\{[^{}]*border-color:\s*Highlight;[^{}]*background:\s*Highlight/);
    expect(forcedColors).toMatch(/\.switch-row input:checked::before\s*\{[^{}]*background:\s*HighlightText/);
  });

  it("keeps the Options summary compact and styles open, hover, forced-color, and reduced-motion states", () => {
    expect(productStyles).toMatch(/\.options-disclosure summary[^{}]*\{[^{}]*min-height:\s*44px/);
    expect(productStyles).toContain(".options-disclosure summary:hover");
    expect(productStyles).toContain(".options-disclosure[open] summary");
    expect(productStyles).toContain(".options-disclosure[open] .options-chevron");
    expect(productStyles).toMatch(/@media \(forced-colors: active\)[\s\S]*\.options-disclosure/);
  });

  it("keeps the navigation vertical at compact widths and fixes shelf geometry", () => {
    expect(productStyles).toContain("--nav-width-compact: 176px");
    expect(productStyles).not.toMatch(/grid-template-rows:\s*108px/);
    expect(productStyles).not.toMatch(/overflow-x:\s*auto;\s*overflow-y:\s*hidden/);
    expect(productStyles).toMatch(/\.content-column[^{}]*\{[^{}]*grid-template-rows:\s*minmax\(0, 1fr\) var\(--shelf-height\)/);
  });

  it("uses only functional motion durations from 120ms through 300ms", () => {
    const durations = [...productStyles.matchAll(/--motion-[\w-]+:\s*(\d+)ms/g)].map((match) => Number(match[1]));
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every((duration) => duration >= 120 && duration <= 300)).toBe(true);
  });

  it("includes forced-colors, reduced-motion, and text-scaling safeguards", () => {
    expect(productStyles).toContain("@media (forced-colors: active)");
    expect(productStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(productStyles).toContain("text-size-adjust: 100%");
  });

  it("defines complete semantic selectors for every light and dark palette combination", () => {
    for (const theme of ["light", "dark"]) {
      expect(productStyles).toContain(`:root[data-theme="${theme}"]`);
      expect(productStyles).toContain(`.app-shell[data-theme="${theme}"]`);
      for (const palette of ["olive", "graphite", "blue", "terracotta"]) {
        const rootSelector = `:root[data-theme="${theme}"][data-palette="${palette}"]`;
        const shellSelector = `.app-shell[data-theme="${theme}"][data-palette="${palette}"]`;
        expect(productStyles).toContain(rootSelector);
        expect(productStyles).toContain(shellSelector);
        const start = productStyles.indexOf(rootSelector);
        const block = productStyles.slice(start, productStyles.indexOf("}", start));
        for (const token of [
          "--surface", "--surface-container-low", "--surface-container", "--surface-container-high", "--surface-bright",
          "--on-surface", "--on-surface-variant", "--outline", "--outline-variant", "--divider", "--disabled-text",
          "--nav-surface", "--nav-surface-high", "--nav-on-surface", "--nav-muted", "--nav-item", "--nav-strong",
          "--nav-hover", "--nav-pressed", "--nav-outline", "--nav-divider",
          "--primary", "--on-primary", "--primary-container", "--on-primary-container", "--primary-label", "--primary-outline", "--primary-hover",
          "--focus-ring", "--selection-background", "--selection-foreground",
        ]) {
          expect(block, `${theme}/${palette} ${token}`).toContain(token);
        }
      }
    }
  });

  it("defines motion tokens in the root theme", () => {
    const rootStart = productStyles.indexOf(":root {");
    const rootBlock = productStyles.slice(rootStart, productStyles.indexOf("}", rootStart));
    for (const token of ["--motion-fast", "--motion-spring", "--motion-spring-smooth"]) {
      expect(rootBlock, token).toContain(token);
    }
    expect(rootBlock).toContain("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(rootBlock).toContain("cubic-bezier(0.25, 0.46, 0.45, 0.94)");
  });

  it("keeps semantic status and PDF colors independent from palette blocks and forced colors authoritative", () => {
    const paletteStart = productStyles.indexOf(':root[data-theme="light"][data-palette="olive"]');
    const forcedColorsStart = productStyles.indexOf("@media (forced-colors: active)");
    const paletteSection = productStyles.slice(paletteStart, forcedColorsStart);
    expect(paletteSection).not.toMatch(/--error:|--warning-container:|--success:|--pdf:/);
    expect(productStyles.slice(forcedColorsStart)).toContain("forced-color-adjust");
    expect(productStyles).toContain("color-scheme: light");
    expect(productStyles).toContain("color-scheme: dark");
  });

  it("keeps surface, navigation, primary, and selection token pairs at text contrast", () => {
    for (const theme of ["light", "dark"]) {
      for (const palette of ["olive", "graphite", "blue", "terracotta"]) {
        const selector = `:root[data-theme="${theme}"][data-palette="${palette}"]`;
        const start = productStyles.indexOf(selector);
        const block = productStyles.slice(start, productStyles.indexOf("}", start));
        const tokens = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]));
        expect(contrast(tokens["--surface"], tokens["--on-surface"]), `${theme}/${palette} surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--surface-container-low"], tokens["--on-surface-variant"]), `${theme}/${palette} surface variant`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--surface"], tokens["--outline"]), `${theme}/${palette} outline`).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens["--surface"], tokens["--focus-ring"]), `${theme}/${palette} focus`).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens["--surface"], tokens["--disabled-text"]), `${theme}/${palette} disabled text`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--nav-surface"], tokens["--nav-item"]), `${theme}/${palette} nav item`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--nav-surface"], tokens["--nav-muted"]), `${theme}/${palette} nav muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--primary"], tokens["--on-primary"]), `${theme}/${palette} primary`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--primary-container"], tokens["--on-primary-container"]), `${theme}/${palette} container`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--surface"], tokens["--primary-label"]), `${theme}/${palette} primary label`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--selection-background"], tokens["--selection-foreground"]), `${theme}/${palette} selection`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps light navigation surfaces clearly lighter than dark navigation surfaces", () => {
    for (const palette of ["olive", "graphite", "blue", "terracotta"]) {
      const lightSelector = `:root[data-theme="light"][data-palette="${palette}"]`;
      const darkSelector = `:root[data-theme="dark"][data-palette="${palette}"]`;
      const lightStart = productStyles.indexOf(lightSelector);
      const lightBlock = productStyles.slice(lightStart, productStyles.indexOf("}", lightStart));
      const darkStart = productStyles.indexOf(darkSelector);
      const darkBlock = productStyles.slice(darkStart, productStyles.indexOf("}", darkStart));
      const lightTokens = tokenValues(lightBlock);
      const darkTokens = tokenValues(darkBlock);
      expect(luminance(lightTokens["--nav-surface"]), `${palette} light nav-surface luminance`).toBeGreaterThan(0.3);
      expect(luminance(lightTokens["--nav-surface-high"]), `${palette} light nav-surface-high luminance`).toBeGreaterThan(0.3);
      expect(luminance(darkTokens["--nav-surface"]), `${palette} dark nav-surface luminance`).toBeLessThan(0.15);
      expect(luminance(darkTokens["--nav-surface-high"]), `${palette} dark nav-surface-high luminance`).toBeLessThan(0.15);
    }
  });

  it("keeps semantic error, warning, success, and PDF identity at text contrast in both themes", () => {
    for (const theme of ["light", "dark"]) {
      const selector = `:root[data-theme="${theme}"]`;
      const start = productStyles.indexOf(selector);
      const block = productStyles.slice(start, productStyles.indexOf("}", start));
      const tokens = tokenValues(block);
      expect(contrast(tokens["--surface"], tokens["--error"]), `${theme} error text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--error-container"], tokens["--on-error-container"]), `${theme} error container`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--success-container"], tokens["--on-success-container"]), `${theme} success container`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--warning-container"], tokens["--on-warning-container"]), `${theme} warning container`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--pdf"], tokens["--on-pdf"]), `${theme} PDF identity`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("does not dilute disabled text contrast with component opacity", () => {
    expect(productStyles).toMatch(/button:disabled\s*\{[^{}]*opacity:\s*1/);
    expect(productStyles).not.toMatch(/\.segmented-field:disabled\s*\{[^{}]*opacity:/);
    expect(productStyles).toMatch(/\.segmented-field:disabled \.segmented-control span\s*\{[^{}]*color:\s*var\(--disabled-text\)[^{}]*background:\s*var\(--surface\)/);
    expect(productStyles).toMatch(/\.primary-action:disabled\s*\{[^{}]*color:\s*var\(--disabled-text\)[^{}]*background:\s*var\(--surface\)/);
  });

  it("uses only system colors for controls opted out of forced color adjustment", () => {
    const forcedColors = productStyles.slice(productStyles.indexOf("@media (forced-colors: active)"));
    expect(forcedColors).toContain(".tool-button.active");
    expect(forcedColors).toContain(".switch-row input:checked");
    expect(forcedColors).toContain(".segmented-control input:checked + span");
    expect(forcedColors).toContain("color: HighlightText");
    expect(forcedColors).toContain("background: Highlight");
    expect(forcedColors).not.toMatch(/forced-color-adjust:\s*none[^}]*var\(--/);
  });

  it("previews each palette with its actual active-theme nav, surface, and primary tokens", () => {
    for (const theme of ["light", "dark"]) {
      for (const palette of ["olive", "graphite", "blue", "terracotta"]) {
        const paletteSelector = `:root[data-theme="${theme}"][data-palette="${palette}"]`;
        const paletteStart = productStyles.indexOf(paletteSelector);
        const paletteBlock = productStyles.slice(paletteStart, productStyles.indexOf("}", paletteStart));
        const paletteTokens = tokenValues(paletteBlock);
        const previewSelector = `.app-shell[data-theme="${theme}"] .palette-preview-${palette}`;
        const previewStart = productStyles.indexOf(previewSelector);
        const previewBlock = productStyles.slice(previewStart, productStyles.indexOf("}", previewStart));
        const previewTokens = tokenValues(previewBlock);
        expect(previewTokens["--preview-nav"], `${theme}/${palette} preview nav`).toBe(paletteTokens["--nav-surface"]);
        expect(previewTokens["--preview-surface"], `${theme}/${palette} preview surface`).toBe(paletteTokens["--surface"]);
        expect(previewTokens["--preview-accent"], `${theme}/${palette} preview primary`).toBe(paletteTokens["--primary"]);
      }
    }
  });
});

function tokenValues(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2].toLowerCase()]));
}

function contrast(first: string, second: string): number {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + .05) / (low + .05);
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
