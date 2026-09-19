# PDF Toolbox

PDF Toolbox is a free desktop application for common PDF tasks. It runs locally on your computer and does not upload files to a server.

PDF Toolbox is free and will always be free.

## What it does

- Merge multiple PDF files
- Extract selected pages
- Remove pages
- Reorder pages
- Rotate pages
- Split a PDF into smaller files
- Convert images to PDF
- Convert PDF pages to images
- Compress PDF files
- Add or remove PDF passwords
- Remove document metadata

## Privacy

PDF Toolbox is designed for local processing. Your files stay on your device. The application does not collect documents, passwords, file paths, usage analytics, or telemetry.

The only network feature is the optional update check in Settings. It contacts GitHub to check whether a newer release is available.

## Download

**[Visit the PDF Toolbox website](https://username-parveen.github.io/pdftoolbox/)** for the easiest download experience, as it will automatically detect and give you the correct version for your operating system.

Or use the direct download links for the latest release (v0.1.0):

- **Windows**: [Download .exe installer](https://github.com/username-parveen/pdftoolbox/releases/download/v0.1.0/PDF.Toolbox_0.1.0_x64-setup.exe)
- **macOS**: [Download .dmg (Universal)](https://github.com/username-parveen/pdftoolbox/releases/download/v0.1.0/PDF.Toolbox_0.1.0_universal.dmg) 
- **Linux**: [Download .AppImage](https://github.com/username-parveen/pdftoolbox/releases/download/v0.1.0/PDF.Toolbox_0.1.0_amd64.AppImage) | [Download .deb](https://github.com/username-parveen/pdftoolbox/releases/download/v0.1.0/PDF.Toolbox_0.1.0_amd64.deb)

To view all versions and source code, check the [GitHub Releases page](https://github.com/username-parveen/pdftoolbox/releases).

## Development

### Requirements

- Node.js 18 or newer
- Rust stable
- Windows 10 or newer for the Windows installer build

### Install dependencies

```sh
npm install
```

### Run in development

```sh
npm run tauri dev
```

### Run tests

```sh
npm test
cd src-tauri && cargo test --no-default-features
```

### Build production installers

```sh
npm run tauri build
```

Installer output is written to:

```text
src-tauri/target/release/bundle/
```

## Third-party components

PDF Toolbox bundles qpdf and PDFium for local PDF processing on Windows. On macOS and Linux, PDFium is bundled automatically during CI builds, but `qpdf` must be installed on your system (e.g., `brew install qpdf` or `apt install qpdf`). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for details.

## License

MIT. See [LICENSE](LICENSE).
