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

Windows installers are available in the release build output:

```text
src-tauri/target/release/bundle/nsis/PDF Toolbox_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/PDF Toolbox_0.1.0_x64_en-US.msi
```

For public distribution, attach these files to a GitHub Release.

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

PDF Toolbox bundles qpdf and PDFium for local PDF processing. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for details.

## License

MIT. See [LICENSE](LICENSE).
