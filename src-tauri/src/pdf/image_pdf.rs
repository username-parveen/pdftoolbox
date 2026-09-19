use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;

use flate2::Compression;
use flate2::write::ZlibEncoder;
use image::ImageReader;

use crate::error::AppError;

const MAX_IMAGES: usize = 1_000;
const MAX_IMAGE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_PIXELS: u64 = 50_000_000;

pub fn validate_image_inputs(inputs: &[impl AsRef<Path>]) -> Result<(), AppError> {
    if inputs.is_empty() || inputs.len() > MAX_IMAGES {
        return Err(AppError::InvalidInput(format!(
            "select between 1 and {MAX_IMAGES} image files"
        )));
    }
    for input in inputs {
        let path = input.as_ref();
        if !path.is_file() {
            return Err(AppError::FileNotFound(path.display().to_string()));
        }
        if !path.extension().is_some_and(is_supported_extension) {
            return Err(AppError::InvalidInput(format!(
                "unsupported image format: {}",
                path.display()
            )));
        }
        if fs::metadata(path)?.len() > MAX_IMAGE_BYTES {
            return Err(AppError::InvalidInput(format!(
                "image exceeds the {} MiB limit: {}",
                MAX_IMAGE_BYTES / 1024 / 1024,
                path.display()
            )));
        }
    }
    Ok(())
}

fn is_supported_extension(extension: &std::ffi::OsStr) -> bool {
    let Some(extension) = extension.to_str() else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "tga" | "tif" | "tiff"
    )
}

#[cfg(test)]
pub fn create_pdf_from_images(inputs: &[impl AsRef<Path>], output: &Path) -> Result<(), AppError> {
    create_pdf_from_images_with_progress(inputs, output, |_, _| Ok(()))
}

pub fn create_pdf_from_images_with_progress(
    inputs: &[impl AsRef<Path>],
    output: &Path,
    mut progress: impl FnMut(u32, u32) -> Result<(), AppError>,
) -> Result<(), AppError> {
    validate_image_inputs(inputs)?;

    let mut writer = PdfWriter::new(output)?;
    let page_objects: Vec<u32> = (0..inputs.len())
        .map(|index| 3 + index as u32 * 3)
        .collect();
    writer.object(1, b"<< /Type /Catalog /Pages 2 0 R >>")?;
    writer.object(
        2,
        format!(
            "<< /Type /Pages /Kids [{}] /Count {} >>",
            page_objects
                .iter()
                .map(|object| format!("{object} 0 R"))
                .collect::<Vec<_>>()
                .join(" "),
            inputs.len()
        )
        .as_bytes(),
    )?;

    for (index, input) in inputs.iter().enumerate() {
        let image = PdfImage::read(input.as_ref())?;
        let page_object = page_objects[index];
        let content_object = page_object + 1;
        let image_object = page_object + 2;
        let (width, height) = image.page_size_points();
        let content = format!("q\n{width:.2} 0 0 {height:.2} 0 0 cm\n/Im0 Do\nQ\n");
        writer.object(
            page_object,
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width:.2} {height:.2}] /Resources << /XObject << /Im0 {image_object} 0 R >> >> /Contents {content_object} 0 R >>"
            )
            .as_bytes(),
        )?;
        writer.stream(content_object, b"", content.as_bytes())?;
        writer.stream(
            image_object,
            format!(
                "/Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /{} /BitsPerComponent 8 /Filter /{}",
                image.width(),
                image.height(),
                image.color_space(),
                image.filter()
            )
            .as_bytes(),
            image.bytes(),
        )?;
        progress(index as u32 + 1, inputs.len() as u32)?;
    }
    writer.finish()
}

struct PdfWriter {
    writer: BufWriter<File>,
    offsets: Vec<u64>,
    position: u64,
}

impl PdfWriter {
    fn new(path: &Path) -> Result<Self, AppError> {
        let mut writer = BufWriter::new(File::create(path)?);
        writer.write_all(b"%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")?;
        Ok(Self {
            writer,
            offsets: vec![0],
            position: 15,
        })
    }

    fn object(&mut self, number: u32, body: &[u8]) -> Result<(), AppError> {
        self.offsets.push(self.position);
        self.write(format!("{number} 0 obj\n").as_bytes())?;
        self.write(body)?;
        self.write(b"\nendobj\n")
    }

    fn stream(&mut self, number: u32, dictionary: &[u8], bytes: &[u8]) -> Result<(), AppError> {
        self.offsets.push(self.position);
        self.write(format!("{number} 0 obj\n<< ").as_bytes())?;
        self.write(dictionary)?;
        self.write(format!(" /Length {} >>\nstream\n", bytes.len()).as_bytes())?;
        self.write(bytes)?;
        self.write(b"\nendstream\nendobj\n")
    }

    fn finish(mut self) -> Result<(), AppError> {
        let xref = self.position;
        self.write(format!("xref\n0 {}\n0000000000 65535 f \n", self.offsets.len()).as_bytes())?;
        let offsets = self.offsets[1..].to_vec();
        for offset in offsets {
            self.write(format!("{offset:010} 00000 n \n").as_bytes())?;
        }
        self.write(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
                self.offsets.len()
            )
            .as_bytes(),
        )?;
        self.writer.flush()?;
        Ok(())
    }

    fn write(&mut self, bytes: &[u8]) -> Result<(), AppError> {
        self.writer.write_all(bytes)?;
        self.position += bytes.len() as u64;
        Ok(())
    }
}

struct JpegImage {
    bytes: Vec<u8>,
    width: u16,
    height: u16,
    components: u8,
    dpi_x: f32,
    dpi_y: f32,
}

enum PdfImage {
    Jpeg(JpegImage),
    Raster(RasterImage),
}

impl PdfImage {
    fn read(path: &Path) -> Result<Self, AppError> {
        if path.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg")
        }) {
            return Ok(Self::Jpeg(JpegImage::read(path)?));
        }
        Ok(Self::Raster(RasterImage::read(path)?))
    }

    fn width(&self) -> u32 {
        match self {
            Self::Jpeg(image) => u32::from(image.width),
            Self::Raster(image) => image.width,
        }
    }

    fn height(&self) -> u32 {
        match self {
            Self::Jpeg(image) => u32::from(image.height),
            Self::Raster(image) => image.height,
        }
    }

    fn color_space(&self) -> &'static str {
        match self {
            Self::Jpeg(image) => image.color_space(),
            Self::Raster(_) => "DeviceRGB",
        }
    }

    fn filter(&self) -> &'static str {
        match self {
            Self::Jpeg(_) => "DCTDecode",
            Self::Raster(_) => "FlateDecode",
        }
    }

    fn bytes(&self) -> &[u8] {
        match self {
            Self::Jpeg(image) => &image.bytes,
            Self::Raster(image) => &image.bytes,
        }
    }

    fn page_size_points(&self) -> (f32, f32) {
        match self {
            Self::Jpeg(image) => image.page_size_points(),
            Self::Raster(image) => image.page_size_points(),
        }
    }
}

struct RasterImage {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

impl RasterImage {
    fn read(path: &Path) -> Result<Self, AppError> {
        let reader = ImageReader::open(path)
            .map_err(|error| AppError::InvalidInput(format!("could not open image: {error}")))?
            .with_guessed_format()
            .map_err(|error| {
                AppError::InvalidInput(format!("could not identify image format: {error}"))
            })?;
        let (width, height) = reader.into_dimensions().map_err(|error| {
            AppError::InvalidInput(format!("could not read image dimensions: {error}"))
        })?;
        if u64::from(width) * u64::from(height) > MAX_PIXELS {
            return Err(AppError::InvalidInput(format!(
                "image exceeds the {MAX_PIXELS}-pixel decoding limit: {}",
                path.display()
            )));
        }
        let rgba = ImageReader::open(path)
            .map_err(|error| AppError::InvalidInput(format!("could not open image: {error}")))?
            .with_guessed_format()
            .map_err(|error| {
                AppError::InvalidInput(format!("could not identify image format: {error}"))
            })?
            .decode()
            .map_err(|error| AppError::InvalidInput(format!("could not decode image: {error}")))?
            .to_rgba8();
        let mut rgb = Vec::with_capacity(rgba.len() / 4 * 3);
        let (pixels, remainder) = rgba.as_raw().as_chunks::<4>();
        debug_assert!(remainder.is_empty());
        for pixel in pixels {
            let alpha = u32::from(pixel[3]);
            for channel in &pixel[..3] {
                rgb.push(((u32::from(*channel) * alpha + 255 * (255 - alpha) + 127) / 255) as u8);
            }
        }
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&rgb)?;
        Ok(Self {
            bytes: encoder.finish()?,
            width,
            height,
        })
    }

    fn page_size_points(&self) -> (f32, f32) {
        (self.width as f32, self.height as f32)
    }
}

impl JpegImage {
    fn read(path: &Path) -> Result<Self, AppError> {
        let bytes = fs::read(path)?;
        let mut image = parse_jpeg(&bytes)?;
        image.bytes = bytes;
        Ok(image)
    }

    fn color_space(&self) -> &'static str {
        match self.components {
            1 => "DeviceGray",
            3 => "DeviceRGB",
            4 => "DeviceCMYK",
            _ => unreachable!("JPEG parser validates component count"),
        }
    }

    fn page_size_points(&self) -> (f32, f32) {
        (
            f32::from(self.width) * 72.0 / self.dpi_x,
            f32::from(self.height) * 72.0 / self.dpi_y,
        )
    }
}

fn parse_jpeg(bytes: &[u8]) -> Result<JpegImage, AppError> {
    if bytes.len() < 4 || bytes[..2] != [0xFF, 0xD8] {
        return Err(AppError::InvalidInput(
            "input is not a valid JPEG stream".into(),
        ));
    }
    let mut position = 2;
    let mut dpi = (72.0, 72.0);
    while position + 1 < bytes.len() {
        if bytes[position] != 0xFF {
            return Err(AppError::InvalidInput(
                "invalid JPEG marker sequence".into(),
            ));
        }
        while position < bytes.len() && bytes[position] == 0xFF {
            position += 1;
        }
        if position >= bytes.len() {
            break;
        }
        let marker = bytes[position];
        position += 1;
        if matches!(marker, 0xD8 | 0xD9 | 0x01 | 0xD0..=0xD7) {
            continue;
        }
        if position + 2 > bytes.len() {
            return Err(AppError::InvalidInput("truncated JPEG segment".into()));
        }
        let length = u16::from_be_bytes([bytes[position], bytes[position + 1]]) as usize;
        if length < 2 || position + length > bytes.len() {
            return Err(AppError::InvalidInput("invalid JPEG segment length".into()));
        }
        let segment = &bytes[position + 2..position + length];
        if marker == 0xE0 && segment.len() >= 12 && &segment[..5] == b"JFIF\0" {
            let units = segment[7];
            let x = u16::from_be_bytes([segment[8], segment[9]]) as f32;
            let y = u16::from_be_bytes([segment[10], segment[11]]) as f32;
            if x > 0.0 && y > 0.0 {
                dpi = match units {
                    1 => (x, y),
                    2 => (x * 2.54, y * 2.54),
                    _ => dpi,
                };
            }
        }
        if matches!(marker, 0xC0..=0xC3 | 0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF) {
            if segment.len() < 6 || segment[0] != 8 {
                return Err(AppError::InvalidInput("unsupported JPEG precision".into()));
            }
            let height = u16::from_be_bytes([segment[1], segment[2]]);
            let width = u16::from_be_bytes([segment[3], segment[4]]);
            let components = segment[5];
            if width == 0 || height == 0 || !matches!(components, 1 | 3 | 4) {
                return Err(AppError::InvalidInput(
                    "unsupported JPEG dimensions or color space".into(),
                ));
            }
            return Ok(JpegImage {
                bytes: Vec::new(),
                width,
                height,
                components,
                dpi_x: dpi.0,
                dpi_y: dpi.1,
            });
        }
        position += length;
    }
    Err(AppError::InvalidInput(
        "JPEG frame header was not found".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::create_pdf_from_images;
    use image::{DynamicImage, ImageFormat, RgbImage};
    use std::fs;
    use std::path::Path;
    use uuid::Uuid;

    #[test]
    fn embeds_original_jpeg_bytes_in_a_valid_pdf_stream() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let input = dir.join("photo.jpg");
        DynamicImage::ImageRgb8(RgbImage::from_pixel(8, 6, image::Rgb([20, 40, 60])))
            .save_with_format(&input, ImageFormat::Jpeg)
            .unwrap();
        let original = fs::read(&input).unwrap();
        let output = dir.join("photos.pdf");

        create_pdf_from_images(&[input], &output).unwrap();

        let pdf = fs::read(&output).unwrap();
        assert!(pdf.windows(original.len()).any(|window| window == original));
        assert!(
            pdf.windows(b"/Filter /DCTDecode".len())
                .any(|window| window == b"/Filter /DCTDecode")
        );
        let qpdf = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "binaries/qpdf/qpdf{}",
            std::env::consts::EXE_SUFFIX
        ));
        assert!(
            std::process::Command::new(qpdf)
                .arg("--check")
                .arg(&output)
                .status()
                .unwrap()
                .success()
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn embeds_png_as_a_losslessly_compressed_pdf_image() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let input = dir.join("transparent.png");
        let mut image = image::RgbaImage::new(3, 2);
        image.put_pixel(0, 0, image::Rgba([0, 0, 0, 0]));
        image.put_pixel(1, 0, image::Rgba([20, 40, 60, 128]));
        DynamicImage::ImageRgba8(image)
            .save_with_format(&input, ImageFormat::Png)
            .unwrap();
        let output = dir.join("images.pdf");

        create_pdf_from_images(&[input], &output).unwrap();

        let pdf = fs::read(&output).unwrap();
        assert!(
            pdf.windows(b"/Filter /FlateDecode".len())
                .any(|window| window == b"/Filter /FlateDecode")
        );
        let qpdf = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "binaries/qpdf/qpdf{}",
            std::env::consts::EXE_SUFFIX
        ));
        assert!(
            std::process::Command::new(qpdf)
                .arg("--check")
                .arg(&output)
                .status()
                .unwrap()
                .success()
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn decodes_common_raster_formats_to_lossless_pdf_images() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let source =
            DynamicImage::ImageRgb8(RgbImage::from_pixel(4, 3, image::Rgb([80, 100, 120])));
        let formats = [
            ("sample.bmp", ImageFormat::Bmp),
            ("sample.gif", ImageFormat::Gif),
            ("sample.tga", ImageFormat::Tga),
            ("sample.tiff", ImageFormat::Tiff),
            ("sample.webp", ImageFormat::WebP),
        ];
        let qpdf = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "binaries/qpdf/qpdf{}",
            std::env::consts::EXE_SUFFIX
        ));

        for (name, format) in formats {
            let input = dir.join(name);
            source.save_with_format(&input, format).unwrap();
            let output = input.with_extension("pdf");
            create_pdf_from_images(&[input], &output).unwrap();
            assert!(
                std::process::Command::new(&qpdf)
                    .arg("--check")
                    .arg(output)
                    .status()
                    .unwrap()
                    .success()
            );
        }
        fs::remove_dir_all(dir).unwrap();
    }
}
