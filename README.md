# PDF Toolbox

A free, private, offline PDF utility desktop application.

PDF Toolbox bundles industry-standard tools (qpdf, pdfium) in a native desktop shell so you can merge, split, rotate, reorder, remove pages, extract pages, convert images to PDF, convert PDF to images, compress, protect, unlock, and strip metadata — all on your machine, with no uploads or network calls.

## Features

- **Organize**: Merge PDFs, extract pages, remove pages, reorder pages, rotate pages, split PDF
- **Convert**: Images to PDF, PDF to images (PNG, JPEG, WebP)
- **Optimize**: Compress PDF (lossless), remove metadata
- **Security**: Add password, remove password

All operations run entirely offline using bundled qpdf and pdfium binaries.

## Requirements

- Windows 10 or later (primary platform)
- macOS 10.15 or later
- Linux with glibc 2.17+ (Ubuntu 18.04+)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) (stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites):
  ```sh
  npm install -g @tauri-apps/cli
  ```

### Run in development

```sh
npm install
npm run tauri dev
```

### Build for production

```sh
npm run tauri build
```

The built application will be placed in `src-tauri/target/release/bundle/`.

### Run tests

```sh
# Rust tests
cd src-tauri && cargo test --no-default-features

# Frontend tests
npm test
```

## License

MIT — see [LICENSE](LICENSE). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for bundled runtime components.
