# PDF Toolbox - Agentic Frontend Master Design and Implementation Prompt

## 1. Role and Mission

You are the lead product designer, senior desktop UX architect, and principal React frontend engineer responsible for redesigning the **PDF Toolbox** interface.

Create a production-ready presentation system for a Windows-first desktop productivity utility. The immediate execution target is a deterministic, browser-based Vite demo. Native integration is a later, separately approved stage.

This is not a landing page, website, SaaS dashboard, or generic upload application. The result must feel like a precise, calm, installed desktop tool designed for repeated professional use.

The experience must be:

- immediately understandable;
- fast and spatially disciplined;
- keyboard and mouse friendly;
- accessible;
- logically progressive;
- difficult to misuse;
- coherent across all 12 tools;
- fully usable offline.

At every state, the interface must answer:

- Where am I?
- Which tool and files am I working with?
- What can I change?
- What is the next valid action?
- What will happen when I continue?
- How can I switch tools or reset this tool safely?

## 2. Non-Negotiable Execution Mode

### 2.1 Demo first

Work in **top-level demo-first Vite mode**. The first implementation and every approval review before Native Integration must run in a normal browser through Vite, without starting any desktop shell or native process.

Before inspecting or modifying frontend code, you **must read `techusedinpdftools.txt` in full**. Treat it as mandatory product and technology context. Then inspect the existing frontend structure, components, tool definitions, icons, CSS, strict TypeScript settings, and frontend tests.

Do not infer capabilities that are absent from `techusedinpdftools.txt` or the existing frontend contracts. Existing product behavior takes priority over design assumptions.

### 2.2 Native boundary

Until the user gives explicit approval at the **Native Integration** gate, do not:

- edit native or backend code;
- edit Tauri or Rust files;
- edit qpdf or PDFium integration;
- edit configuration files of any kind;
- edit native, build, packaging, installer, or distribution configuration;
- build, package, install, or launch the desktop application;
- run native integration tests;
- invoke real PDF processing;
- wire the demo to native dialogs, native drag/drop, IPC, or native jobs.

The frontend-only npm script and browser demo entry described below are permitted. They must not alter native configuration or production integration.

Earlier approval gates authorize continued browser-demo work only. They do not imply Native Integration approval.

### 2.3 Exact demo entry structure

Use this exact top-level demo structure:

```text
demo.html
src/demo/main.tsx
src/demo/DemoApp.tsx
src/demo/scenarios.ts
src/demo/DemoControls.tsx
```

Expose the demo through exactly:

```text
npm run demo
```

Requirements:

- `demo.html` is the browser entry at the repository top level.
- `src/demo/main.tsx` mounts the demo only.
- `src/demo/DemoApp.tsx` composes the real shared presentation components.
- `src/demo/scenarios.ts` contains deterministic typed fixtures and scenario definitions.
- `src/demo/DemoControls.tsx` contains development-only scenario controls.
- Do not create a nested demo project, second package, or alternate UI implementation.

## 3. Architecture Contract

### 3.1 Shared presentation, separate control layers

Build one production-ready presentation layer and one CSS system. The browser demo and eventual production application must render the same components, markup, tokens, and responsive behavior.

Keep these responsibilities separate:

```text
Shared presentation components and CSS
        ^                       ^
        |                       |
Demo mock adapter/controller   Production adapter/controller
```

The demo mock adapter/controller owns deterministic file selection, validation, progress, completion, cancellation, errors, and reset transitions. It must not leak demo concerns into shared presentation components.

The later production adapter/controller may connect the same presentation contract to real capabilities only after Native Integration approval.

Do not:

- duplicate tool screens for screenshots;
- fork production markup into a demo-only frontend;
- place fixture selection logic inside presentation components;
- scatter native calls through visual components;
- make shared components aware of the development control rail;
- lower component quality because the first runtime is a demo.

### 3.2 Presentation component strategy

Prefer reusable components such as:

- `AppShell`
- `NavigationPane`
- `NavigationGroup`
- `NavigationItem`
- `WorkflowHeader`
- `WorkflowStage`
- `TaskSection`
- `FileDropSurface`
- `FileList`
- `FileRow`
- `SettingGroup`
- `FieldRow`
- `SegmentedControl`
- `ButtonGroup`
- `StatusChip`
- `PrivacyIndicator`
- `EngineStatus`
- `InlineNotice`
- `ErrorBanner`
- `ProgressIndicator`
- `TaskActionShelf`
- `EmptyState`
- `ResultSummary`

Keep tool-specific content and controls data-driven where practical. Do not duplicate complete page layouts when only labels, accepted inputs, or settings differ.

### 3.3 Framework and asset restrictions

Do not add MUI or any heavy Material component framework. Do not add another general-purpose design system merely to style the demo.

Implement the interface with:

- semantic HTML;
- strict TypeScript;
- React patterns already compatible with the repository;
- custom CSS tokens and shared CSS;
- existing local icon infrastructure;
- existing dependencies unless a small frontend-only dependency is demonstrably necessary and approved.

Do not use remote fonts, hosted icons, CDN assets, or runtime network dependencies.

Material 3 Expressive may inform hierarchy, state, color, shape contrast, and motion, but the implementation must have a distinct PDF Toolbox identity and desktop density. Do not imitate an Android layout or Google product.

## 4. Product Scope

Implement exactly the existing 12-tool scope. Do not invent features.

### Convert

1. Images to PDF
2. PDF to Images
3. PDF to Text

### Organize

4. Merge PDFs
5. Extract Pages
6. Reorder Pages
7. Rotate Pages
8. Split PDF

### Optimize

9. Lossless Optimize

### Security

10. Protect PDF
11. Unlock PDF
12. Reduce Metadata

Do not imply or add:

- OCR;
- PDF text editing;
- digital signatures;
- cloud sync;
- accounts;
- analytics or telemetry;
- Office or HTML conversion;
- persistent cloud history;
- visual or thumbnail-based page editing;
- unsupported image formats;
- target-file-size compression;
- AI functionality.

## 5. Desktop Interaction Model

### 5.1 Desktop application rule

Design a coherent workstation:

```text
desktop shell + persistent tool navigation + task canvas
+ contextual settings + stable action/status shelf
```

Avoid:

- marketing hero sections;
- giant welcome banners;
- dashboard metric cards;
- browser-style upload language;
- huge empty margins;
- mobile navigation transplanted onto desktop;
- giant mobile buttons or unjustified floating action buttons;
- glassmorphism, decorative blobs, and gratuitous gradients;
- a rounded card around every section;
- webpage-like scrolling for basic operations;
- navigation that disappears during a workflow.

### 5.2 Target canvas and demo rail

The primary review canvas is exactly **1240 x 800**. It represents the application viewport and contains only production-ready UI.

`DemoControls` must render in an **external development-only rail outside the 1240 x 800 canvas**. The rail may select tools, scenarios, viewport presets, and deterministic transitions, but it must:

- never overlay or resize the review canvas;
- never appear in production components;
- be excluded from screenshots;
- be excluded from visual acceptance judgments;
- remain visually utilitarian so it cannot be mistaken for product UI.

The product UI must also remain usable in compact desktop windows and scale cleanly to larger windows. The 1240 x 800 canvas is the primary review target, not a license to hard-code a non-adaptive layout.

### 5.3 Recommended shell

```text
+------------------------------------------------------------------+
| Application title / compact utility region                       |
+----------------+-------------------------------------------------+
| PDF Toolbox    | Category / Tool / contextual status             |
|                | Tool title and concise explanation               |
| Convert        +-------------------------------------------------+
| Organize       |                                                 |
| Optimize       | Active task workspace                           |
| Security       |                                                 |
|                | Input -> Configure -> Confirm -> Process -> Result|
| Direct tools   |                                                 |
| remain visible +-------------------------------------------------+
| Local/privacy  | Contextual action and status shelf               |
+----------------+-------------------------------------------------+
```

Every visible edge should align with a meaningful axis shared by titles, input, fields, file rows, status, or actions.

### 5.4 Persistent direct tool navigation

Use a true desktop navigation pane containing:

- PDF Toolbox identity;
- Convert, Organize, Optimize, and Security groups;
- all 12 tools;
- active-tool indication;
- compact local-processing or capability information near the bottom.

Navigation remains available throughout every workflow. A user returns to any tool directly by selecting it; do not impose a permanent history-navigation control.

When switching tools with unsaved or sensitive input, use clear context-preservation or confirmation behavior appropriate to the risk. Do not silently discard selected files or passwords.

An optional contextual **Reset tool** action may appear when the current tool has state worth clearing. It must:

- apply only to the active tool;
- appear only when useful;
- explain destructive consequences when necessary;
- restore the tool's initial state without changing the selected tool;
- never occupy permanent global navigation space.

### 5.5 Workflow continuity

Every tool conceptually follows:

```text
SELECT TOOL
    -> CHOOSE INPUT
    -> CONFIGURE
    -> CONFIRM OUTPUT INTENT
    -> PROCESS
    -> RESULT
```

Tools with safe defaults may show a compact configuration summary rather than empty ceremony. Every state must make the current stage and next valid action obvious.

There should normally be one visually dominant action at a time. Secondary, tertiary, cancel, dismiss, and destructive actions must use appropriately lower or distinct emphasis.

Place commitment actions where the eye naturally ends after configuration, generally toward the lower-right of the task region. Keep the action/status shelf stable enough to avoid layout jumps.

## 6. Geometry and Visual System

### 6.1 Practical 4px geometry

Use a practical base unit:

```text
u = 4px
```

Build spacing, control dimensions, and layout offsets from clear multiples of 4px wherever practical. Typical spacing values may include 4, 8, 12, 16, 20, 24, 32, 40, and 48px.

Use exceptions when text metrics, borders, optical icon alignment, minimum hit targets, or responsive constraints require them. Do not nudge elements with unexplained values merely to make a screenshot look right.

Ratios such as 13:8 or the golden ratio are optional compositional references only. They are never acceptance criteria, must never override usable widths or content needs, and require no numerical proof.

Acceptance is based on practical alignment, readable density, predictable hierarchy, responsive behavior, and task usability.

### 6.2 Proximity and alignment

Use semantic distance:

- icon to label: commonly 8px;
- closely related controls: commonly 8-12px;
- fields in one group: commonly 12-20px;
- separate groups: commonly 20-32px;
- major workflow regions: commonly 32-48px.

These are working ranges, not rigid formulas. Related items must be closer than unrelated items.

Maintain shared axes for:

- application and tool titles;
- workflow stage;
- drop surfaces and file lists;
- setting labels and fields;
- validation and supporting text;
- status content;
- action shelf controls.

### 6.3 Shape and containment

Use moderate shape contrast to identify hierarchy and function. Keep controls compact, preserve familiar field shapes, and reserve larger radii for meaningful surfaces.

Do not make every control a pill. Do not nest cards inside cards. Prefer alignment, whitespace, typography, dividers, and subtle tonal changes before adding another container.

### 6.4 Semantic CSS tokens

Create a coherent shared token layer for:

- color and surface roles;
- text roles;
- spacing;
- typography;
- radii;
- borders and focus rings;
- control heights;
- navigation and layout metrics;
- elevation;
- motion.

At minimum, provide semantic roles equivalent to:

```text
--surface
--surface-container-low
--surface-container
--surface-container-high
--on-surface
--on-surface-variant
--outline
--outline-variant
--primary
--on-primary
--primary-container
--on-primary-container
--error
--error-container
--success
--success-container
--focus-ring
```

Do not scatter raw color values or unrelated magic numbers through component CSS.

### 6.5 Typography and icons

Use locally available or already bundled fonts. Keep typography functional, desktop-appropriate, and restrained. Establish clear levels for application identity, tool title, section title, labels, body, supporting text, status, and actions.

Avoid giant page headings, excessive uppercase, and marketing copy.

Use the existing local/shared icon system. Keep icon stroke or fill treatment, optical size, and alignment consistent. Icons must not replace critical text where meaning would become ambiguous.

### 6.6 Motion

Motion must explain continuity, selection, state change, or progress. Prefer short desktop transitions and respect `prefers-reduced-motion`.

Avoid bouncing screens, exaggerated springs, slow page transitions, animated decoration, perpetual motion, and expensive filters.

## 7. Input and File Management

### 7.1 Empty input

Use a refined local file drop surface that communicates:

- accepted file type;
- single or multiple selection;
- drag/drop availability;
- a clear Choose File or Choose Files action.

Use language such as **Drop PDFs here**, not **Upload files**, because processing is local.

Before Native Integration approval, simulate choosing and dropping files through the demo controller only. Do not call native pickers or native drag/drop APIs.

### 7.2 Selected files

Transition selected input into a compact desktop file list. Show only information available in the current contracts, including:

- file type;
- filename;
- path;
- ordering controls when relevant;
- removal action.

Give filenames stronger hierarchy than paths. For multiple inputs, the visible order must match processing order. Ordering controls must remain understandable and must not compete visually with removal.

Do not invent thumbnail editing or unavailable preview data.

### 7.3 Drag/drop states

Design deterministic states for:

- normal;
- drag entering;
- valid drag;
- invalid drag;
- accepted drop;
- rejected drop;
- elevated Windows drag/drop warning.

Communicate state with iconography, border or surface treatment, and concise text, never color alone.

## 8. Exact Tool Workflows

Respect the capabilities documented in `techusedinpdftools.txt` and represented by current frontend contracts. The demo simulates these workflows; it does not execute PDF operations.

### 8.1 Images to PDF

```text
Choose/add supported images
-> Review ordering
-> Show safe configuration summary
-> Confirm output intent
-> Processing
-> Result
```

Do not invent page-layout options or unsupported image formats.

### 8.2 PDF to Images

```text
Choose PDF
-> Select PNG, JPEG, or WebP
-> Select 96, 144, or 300 DPI
-> Optionally enter page range
-> Confirm destination intent
-> Per-page processing
-> Result
```

Group format, resolution, and pages as related configuration. Do not scatter them across unrelated surfaces.

### 8.3 PDF to Text

```text
Choose PDF
-> Optionally enter page range
-> Confirm output intent
-> Extract embedded text
-> Result
```

State clearly that existing embedded text is extracted. Do not imply OCR.

### 8.4 Merge PDFs

```text
Choose at least two PDFs
-> Review and reorder files
-> Show safe defaults
-> Confirm output intent
-> Merge
-> Result
```

File order is the key configuration and must be visually obvious.

### 8.5 Extract Pages

```text
Choose PDF
-> Enter page range
-> Validate range
-> Confirm output intent
-> Extract
-> Result
```

Provide concise syntax guidance such as `1-5, 8, 11-14`. Place validation next to the field.

### 8.6 Reorder Pages

```text
Choose PDF
-> Enter page sequence
-> Validate sequence
-> Confirm output intent
-> Reorder
-> Result
```

Use the current sequence-based workflow. Do not invent a thumbnail page editor.

### 8.7 Rotate Pages

```text
Choose PDF
-> Select pages
-> Select 90, 180, or 270 degrees
-> Confirm output intent
-> Rotate
-> Result
```

Present rotation choices as one tightly related control group.

### 8.8 Split PDF

```text
Choose PDF
-> Set every N pages
-> Validate
-> Confirm destination intent
-> Multi-output processing
-> Result
```

### 8.9 Lossless Optimize

```text
Choose PDF
-> Show safe-default summary
-> Confirm output intent
-> Optimize
-> Result
```

Do not imply lossy downsampling or target-file-size compression.

### 8.10 Protect PDF

```text
Choose PDF
-> Enter password
-> Show only supported owner-password behavior, if any
-> Present security disclosure
-> Confirm output intent
-> Protect
-> Result
```

Never expose passwords accidentally. Model clearing and retention according to documented frontend behavior. Keep security disclosures concise and explicit.

### 8.11 Unlock PDF

```text
Choose encrypted PDF
-> Enter password
-> Confirm output intent
-> Unlock
-> Result
```

Missing and incorrect passwords must remain distinguishable.

### 8.12 Reduce Metadata

```text
Choose PDF
-> Explain reduction behavior
-> Show safe defaults
-> Confirm output intent
-> Reduce metadata
-> Result
```

Do not promise removal of every possible metadata value.

## 9. State Model and Demo Scenarios

The demo must be deterministic and capable of presenting every important visual state without real file dialogs or PDF processing.

`src/demo/scenarios.ts` must provide typed scenarios covering:

- all 12 tools;
- empty input;
- single file;
- multiple files;
- long filenames;
- long paths;
- ordering changes;
- drag-over;
- rejected drop;
- valid and selected configuration;
- invalid range or sequence;
- queued job;
- stage progress;
- per-page progress;
- per-image progress;
- completed;
- failed;
- cancelled;
- destination permission failure;
- elevated Windows warning;
- processing capability unavailable;
- standard desktop width;
- compact desktop width.

Every reusable interactive component must define relevant states for:

- default;
- hover;
- active or pressed;
- focus-visible;
- selected;
- disabled;
- loading;
- validation error;
- success;
- drag-over.

Do not rely on nondeterministic timers for screenshot states. Demo controls may offer explicit state transitions, but a scenario must be directly selectable and reproducible.

## 10. Progress, Completion, and Errors

### 10.1 Progress

Represent only progress values supplied by the active adapter. In the demo, fixtures must be labeled and structured as simulated data. In later production integration, the adapter must map real progress without fabricating intermediate percentages.

Support:

- queued;
- running;
- completed;
- failed;
- cancelled.

While running, show available information such as:

- tool name;
- readable status message;
- current stage;
- total stages when known;
- page or image progress when applicable;
- a clearly distinct Cancel action.

Never show fake precision or animate invented progress. Motion may interpolate the display of real state changes but must not misrepresent work completed.

### 10.2 Completion

Completion should feel final but restrained. Show a clear success state, concise language, output paths when supplied by the adapter, and an appropriate dismiss or tool-reset action.

Do not use confetti, celebrations, or unrelated calls to action.

### 10.3 Errors

Design readable states for:

- invalid extension;
- invalid page range or sequence;
- missing or unreadable file;
- unwritable destination;
- existing-output conflict;
- corrupt PDF;
- PDFium unavailable;
- qpdf unavailable;
- qpdf too old or otherwise incompatible;
- other processing capability unavailable or incompatible;
- password required;
- incorrect password;
- cancellation;
- oversized raster input;
- cleanup or rollback failure;
- elevated Windows drag/drop restriction.

Each error must answer:

1. What happened?
2. What caused it, when known?
3. What can the user do next?
4. Which input and configuration remain preserved?

Use a readable user-facing message first. Preserve useful technical detail only as subordinate disclosure. Never expose raw implementation errors as the primary message.

## 11. Accessibility and Keyboard Use

Accessibility is part of component design, not a final polish pass.

Requirements:

- semantic landmarks and heading hierarchy;
- semantic HTML buttons and form controls where suitable;
- accessible names and descriptions;
- logical tab order;
- visible `:focus-visible` treatment;
- Enter for safe context-specific confirmation;
- Space for buttons and toggles;
- expected arrow-key behavior for list and segmented controls;
- Escape for dismissing transient overlays;
- focus movement to a newly active workflow region when helpful;
- focus or announcement for validation failures;
- no repeated focus stealing during progress;
- `aria-live` for appropriate status updates;
- `role="alert"` for blocking errors;
- proper progress semantics;
- status communication that does not depend on color;
- strong text and control contrast;
- reduced-motion support.

Do not add global shortcuts that conflict with text fields, browser behavior, assistive technology, or direct tool navigation.

## 12. Offline, Privacy, and Performance

The interface must remain fully functional with the network disabled.

Therefore:

- no remote fonts;
- no CDN icons;
- no remote illustrations;
- no analytics or telemetry;
- no cloud dependency;
- no runtime theme downloads;
- no copy that says files are uploading.

Present local processing as a subtle confidence signal, not a dominant marketing claim. Keep capability status compact and secondary.

Visual polish must not compromise performance. Avoid huge DOM trees, unnecessary rerenders, large libraries imported wholesale, expensive animated filters, giant blur layers, and JavaScript animation when CSS is sufficient.

## 13. Approval Gates

Work incrementally and stop for explicit approval at each named gate. Present the browser demo and a concise checklist of what changed. Do not silently continue into the next gate.

### Gate 1: Shell

Deliver in browser demo mode:

- shared tokens and CSS foundations;
- the 1240 x 800 product canvas;
- the external dev-only control rail;
- application shell;
- persistent direct tool navigation with all 12 tools;
- workflow header;
- workspace geometry;
- action/status shelf;
- representative empty and populated content.

Acceptance focuses on desktop character, hierarchy, practical 4px alignment, density, and navigation clarity. Optional compositional ratios are not reviewed as criteria.

### Gate 2: Workflow

Deliver all 12 workflows through shared production-ready presentation components and the demo adapter/controller.

Acceptance focuses on accurate scope, predictable stages, file management, settings grouping, validation, output intent, one dominant action, and absence of duplicated UI.

### Gate 3: States

Deliver all required deterministic scenarios, interaction states, progress, completion, cancellation, errors, compact behavior, keyboard behavior, and accessibility semantics.

Acceptance focuses on state completeness, context preservation, honest progress representation, accessible operation, and reproducible demo controls.

### Gate 4: Precision

Perform a dedicated browser visual pass for:

- alignment and baseline rhythm;
- spacing and control heights;
- radius and border consistency;
- icon optical alignment;
- focus treatment;
- typography and text wrapping;
- long filenames and paths;
- scrolling and sticky regions;
- 1240 x 800 fit;
- compact-window behavior;
- reduced motion;
- screenshot cleanliness with the dev rail excluded.

Acceptance is visual and functional, not ratio-based.

### Gate 5: Native Integration

Do not begin this gate until the user explicitly approves **Native Integration** by name.

Only that approval permits planning or implementing production adapter wiring and native integration. Before changing anything, re-audit the approved shared presentation contract against `techusedinpdftools.txt` and current integration boundaries. Keep native work minimal and separate from visual components.

Native builds, packaging, installer work, or desktop launches remain out of scope unless the user separately requests them even after this gate is approved.

## 14. Demo-Only Verification

Before Native Integration approval, verification is strictly frontend and browser based. Run only:

- existing frontend unit or component tests;
- strict TypeScript type checking with no emit;
- the Vite browser dev mode exposed by `npm run demo`;
- a browser-only Vite build of the demo entry;
- browser-based visual, responsive, keyboard, accessibility, and screenshot checks.

Do not run native tests, desktop builds, desktop launch commands, packaging, installer generation, or real PDF operations.

Do not declare a gate ready while relevant frontend tests, strict TypeScript checks, or the browser Vite build fail. Report the exact command and any limitation when a check cannot run.

## 15. Screen Review Checklist

For every tool and important scenario, verify:

1. Is the active category and tool obvious?
2. Does persistent navigation provide direct access to every tool?
3. Is the current workflow stage obvious?
4. Is the next valid action obvious?
5. Is there only one dominant action?
6. Are related controls grouped and aligned?
7. Are filenames stronger than paths?
8. Is configuration arranged consistently?
9. Does progress reuse a stable region?
10. Do errors preserve useful user context?
11. Can the workflow be operated with a keyboard?
12. Are focus and status changes accessible?
13. Does the screen feel like desktop software?
14. Is any element merely decorative?
15. Is any supported capability hidden?
16. Is any unsupported feature implied?
17. Is an optional Reset tool action shown only when contextually useful?
18. Is the development rail outside the product canvas and absent from screenshots?
19. Does the screen use shared presentation components and CSS?
20. Does the scenario remain deterministic without native execution?

Fix failures before presenting the applicable approval gate.

## 16. Definition of Done

The frontend redesign is complete only when:

- the canonical product name is PDF Toolbox throughout visible content;
- `techusedinpdftools.txt` has been read and its constraints respected;
- the exact top-level demo structure and `npm run demo` are present;
- the demo runs in a browser without a desktop or native process;
- all 12 tools are represented accurately;
- all workflows use shared production-ready presentation components and CSS;
- demo behavior is isolated in a typed mock adapter/controller;
- no duplicate screenshot frontend exists;
- persistent direct tool navigation remains available throughout workflows;
- Reset tool is contextual and optional rather than a permanent global control;
- all required deterministic demo scenarios are available;
- progress, completion, cancellation, and errors are explicit and honest;
- the 1240 x 800 product canvas is polished and adaptive;
- the development rail remains outside the canvas and screenshots;
- geometry uses practical 4px discipline without ratio-based acceptance;
- custom semantic CSS, semantic HTML, and existing local icons are used;
- no MUI or heavy Material framework has been added;
- keyboard and accessibility behavior are coherent;
- the interface remains fully offline;
- frontend tests pass;
- strict TypeScript checks pass;
- browser Vite development and build checks pass;
- no native or backend boundary has been crossed before explicit Native Integration approval;
- each named approval gate has been presented and explicitly approved before dependent work;
- the result looks intentionally designed rather than generated from generic patterns.

## Final Execution Directive

Treat this redesign as a system-design and interaction-design problem, not a CSS reskin.

Start with the mandatory technology-context read, then create the exact browser demo entry and build one shared presentation system. Progress only through the named approval gates. Keep deterministic demo control outside the product UI, keep all native boundaries untouched until explicit Native Integration approval, and never duplicate the interface for screenshots.

The user should experience PDF Toolbox as one continuous, predictable instrument with persistent direct tool access, clear current state, an anticipated next action, honest progress, recoverable errors, and disciplined desktop geometry.

Every control must have a reason for its location. Every spacing value must belong to a practical system. Every component state must be intentional. Every tool must feel like part of the same product.
