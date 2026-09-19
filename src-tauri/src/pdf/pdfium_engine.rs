use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use image::ImageFormat;
use pdfium_render::prelude::*;
use serde::Deserialize;

use crate::error::AppError;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RenderFormat {
    Jpeg,
    Png,
    Webp,
}

impl RenderFormat {
    fn extension(self) -> &'static str {
        match self {
            Self::Jpeg => "jpg",
            Self::Png => "png",
            Self::Webp => "webp",
        }
    }

    fn image_format(self) -> ImageFormat {
        match self {
            Self::Jpeg => ImageFormat::Jpeg,
            Self::Png => ImageFormat::Png,
            Self::Webp => ImageFormat::WebP,
        }
    }
}

#[derive(Clone)]
pub struct PdfiumEngine {
    pdfium: Arc<Mutex<Pdfium>>,
}

impl PdfiumEngine {
    pub fn load(library_path: &Path) -> Result<Self, AppError> {
        if !library_path.is_file() {
            return Err(AppError::EngineError(format!(
                "PDFium library was not found: {}",
                library_path.display()
            )));
        }
        let bindings = Pdfium::bind_to_library(library_path)
            .map_err(|error| AppError::EngineError(format!("could not load PDFium: {error}")))?;
        Ok(Self {
            pdfium: Arc::new(Mutex::new(Pdfium::new(bindings))),
        })
    }

    pub fn page_count(&self, input: &Path) -> Result<u32, AppError> {
        let pdfium = self
            .pdfium
            .lock()
            .map_err(|_| AppError::EngineError("PDFium lock poisoned".into()))?;
        let document = pdfium
            .load_pdf_from_file(input, None)
            .map_err(pdfium_error)?;
        Ok(document.pages().len() as u32)
    }

    pub fn render_pages(
        &self,
        input: &Path,
        output_directory: &Path,
        format: RenderFormat,
        dpi: u16,
        page_numbers: &[u32],
        mut progress: impl FnMut(u32, u32) -> Result<(), AppError>,
    ) -> Result<Vec<PathBuf>, AppError> {
        let pdfium = self
            .pdfium
            .lock()
            .map_err(|_| AppError::EngineError("PDFium lock poisoned".into()))?;
        let document = pdfium
            .load_pdf_from_file(input, None)
            .map_err(pdfium_error)?;
        let pages: Vec<_> = document
            .pages()
            .iter()
            .enumerate()
            .filter(|(index, _)| {
                page_numbers.is_empty() || page_numbers.contains(&(*index as u32 + 1))
            })
            .collect();
        let total = pages.len() as u32;
        let stem = input
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("page");
        let mut outputs = Vec::with_capacity(pages.len());
        for (position, (index, page)) in pages.into_iter().enumerate() {
            let width = (page.width().value * f32::from(dpi) / 72.0).round() as i32;
            let image = page
                .render_with_config(&PdfRenderConfig::new().set_target_width(width))
                .map_err(pdfium_error)?
                .as_image()
                .map_err(pdfium_error)?;
            let output = output_directory.join(format!(
                "{stem}-page-{:03}.{}",
                index + 1,
                format.extension()
            ));
            image
                .save_with_format(&output, format.image_format())
                .map_err(|error| AppError::IoError(error.to_string()))?;
            outputs.push(output);
            progress(position as u32 + 1, total)?;
        }
        Ok(outputs)
    }
}

fn pdfium_error(error: PdfiumError) -> AppError {
    AppError::PdfCorrupt(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{PdfiumEngine, RenderFormat};
    use std::fs;
    use std::path::Path;
    use uuid::Uuid;

    #[test]
    #[cfg(windows)]
    fn renders_a_page_to_png_with_the_bundled_pdfium_library() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let engine = PdfiumEngine::load(&root.join("binaries/pdfium/bin/pdfium.dll")).unwrap();
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let input = dir.join("source.pdf");
        write_one_page_pdf(&input);

        let output = dir.join("images");
        fs::create_dir(&output).unwrap();
        let pages = engine
            .render_pages(&input, &output, RenderFormat::Png, 96, &[], |_, _| Ok(()))
            .unwrap();

        assert_eq!(pages.len(), 1);
        assert_eq!(image::open(&pages[0]).unwrap().width(), 816);
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(windows)]
    fn write_one_page_pdf(path: &Path) {
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
            "<< /Length 0 >>\nstream\n\nendstream",
        ];
        let mut bytes = b"%PDF-1.4\n".to_vec();
        let mut offsets = Vec::new();
        for (index, object) in objects.iter().enumerate() {
            offsets.push(bytes.len());
            bytes
                .extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
        }
        let xref = bytes.len();
        bytes.extend_from_slice(
            format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
        );
        for offset in offsets {
            bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        bytes.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        fs::write(path, bytes).unwrap();
    }
}
