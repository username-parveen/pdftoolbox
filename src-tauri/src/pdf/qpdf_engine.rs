use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use serde::Serialize;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;
use crate::jobs::model::Operation;
use crate::page_range::parse_page_range;

#[derive(Clone)]
pub struct QpdfEngine {
    executable: Option<PathBuf>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineCapabilities {
    pub qpdf: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qpdf_version: Option<String>,
    pub pdfium: bool,
    pub elevated: bool,
}

impl QpdfEngine {
    pub fn discover_with_bundled(bundled: Option<PathBuf>) -> Self {
        Self {
            executable: bundled.filter(|path| path.is_file()).or_else(find_qpdf),
        }
    }

    pub fn capabilities(&self) -> EngineCapabilities {
        let version = self.detected_version();
        EngineCapabilities {
            qpdf: version.as_deref().is_some_and(is_supported_qpdf_version),
            qpdf_version: version,
            pdfium: false,
            elevated: false,
        }
    }

    pub fn require_available(&self) -> Result<&Path, AppError> {
        let executable = self.executable.as_deref().ok_or_else(|| {
            AppError::EngineError(
                "qpdf was not found. Install qpdf or set QPDF_PATH to its executable.".into(),
            )
        })?;
        if !self
            .detected_version()
            .as_deref()
            .is_some_and(is_supported_qpdf_version)
        {
            return Err(AppError::EngineError(
                "qpdf 11.7 or newer is required".into(),
            ));
        }
        Ok(executable)
    }

    fn detected_version(&self) -> Option<String> {
        self.executable.as_ref().and_then(|path| {
            let mut command = std::process::Command::new(path);
            command.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(CREATE_NO_WINDOW);
        }
            command
                .output()
                .ok()
                .filter(|output| output.status.success())
                .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
        })
    }

    pub fn validate_operation(&self, operation: &Operation) -> Result<(), AppError> {
        self.require_available()?;
        let paths = operation.input_paths();
        if paths.is_empty() {
            return Err(AppError::InvalidInput(
                "select at least one input PDF".into(),
            ));
        }
        if matches!(operation, Operation::Merge { .. }) && paths.len() < 2 {
            return Err(AppError::InvalidInput(
                "merge requires at least two PDFs".into(),
            ));
        }
        for path in paths {
            if !path.is_file() {
                return Err(AppError::FileNotFound(path.display().to_string()));
            }
            if !path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
            {
                return Err(AppError::InvalidInput(format!(
                    "not a PDF file: {}",
                    path.display()
                )));
            }
            std::fs::File::open(path)
                .map_err(|_| AppError::FileLocked(path.display().to_string()))?;
        }
        match operation {
            Operation::Rotate { degrees, .. } if !matches!(degrees, 90 | 180 | 270) => Err(
                AppError::InvalidInput("rotation must be 90, 180, or 270 degrees".into()),
            ),
            Operation::Split { every, .. } if *every == 0 || *every > 10_000 => Err(
                AppError::InvalidInput("split size must be between 1 and 10000".into()),
            ),
            Operation::Protect { user_password, .. } if user_password.is_empty() => {
                Err(AppError::InvalidInput("a user password is required".into()))
            }
            Operation::Extract { input_path, pages }
            | Operation::Reorder { input_path, pages }
            | Operation::Remove { input_path, pages } => {
                let total_pages = self.page_count(input_path)?;
                parse_page_range(pages, total_pages, false)
                    .map(|_| ())
                    .map_err(AppError::InvalidInput)
            }
            _ => Ok(()),
        }
    }

    fn page_count(&self, path: &Path) -> Result<u32, AppError> {
        let mut command = std::process::Command::new(self.require_available()?);
        command.args([path.as_os_str(), std::ffi::OsStr::new("--show-npages")]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let output = command.output()?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(AppError::PdfCorrupt(detail));
        }
        String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<u32>()
            .map_err(|_| AppError::PdfCorrupt("qpdf returned an invalid page count".into()))
    }

    pub async fn execute(
        &self,
        operation: &Operation,
        output: &Path,
        cancellation: &CancellationToken,
    ) -> Result<(), AppError> {
        self.validate_operation(operation)?;
        let normalized_operation = if let Operation::Extract { input_path, pages } = operation {
            let total_pages = self.page_count(input_path)?;
            let pages = parse_page_range(pages, total_pages, false)
                .map_err(AppError::InvalidInput)?
                .into_iter()
                .map(|page| page.to_string())
                .collect::<Vec<_>>()
                .join(",");
            Some(Operation::Extract {
                input_path: input_path.clone(),
                pages,
            })
        } else {
            None
        };
        let args = build_args(normalized_operation.as_ref().unwrap_or(operation), output)?;
        self.run(args, cancellation).await
    }

    pub async fn execute_split(
        &self,
        input: &Path,
        every: u32,
        output_pattern: &Path,
        cancellation: &CancellationToken,
    ) -> Result<(), AppError> {
        let args = vec![
            input.as_os_str().to_owned(),
            OsString::from(format!("--split-pages={every}")),
            OsString::from("--"),
            output_pattern.as_os_str().to_owned(),
        ];
        self.run(args, cancellation).await
    }

    pub async fn verify(
        &self,
        path: &Path,
        cancellation: &CancellationToken,
    ) -> Result<(), AppError> {
        self.verify_with_password(path, None, cancellation).await
    }

    pub async fn verify_with_password(
        &self,
        path: &Path,
        password: Option<&str>,
        cancellation: &CancellationToken,
    ) -> Result<(), AppError> {
        let mut args = Vec::with_capacity(3);
        if let Some(password) = password {
            args.push(OsString::from(format!("--password={password}")));
        }
        args.extend([OsString::from("--check"), path.as_os_str().to_owned()]);
        self.run(args, cancellation)
            .await
            .map_err(|error| match error {
                AppError::EngineError(message) => AppError::PdfCorrupt(message),
                other => other,
            })
    }

    async fn run(
        &self,
        args: Vec<OsString>,
        cancellation: &CancellationToken,
    ) -> Result<(), AppError> {
        let executable = self.require_available()?;
        let mut command = Command::new(executable);
        command
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(windows)]
        {
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn()?;
        let mut stdout = child.stdout.take().expect("qpdf stdout is piped");
        let mut stderr = child.stderr.take().expect("qpdf stderr is piped");
        let stdout_reader = tokio::spawn(async move {
            let mut bytes = Vec::new();
            stdout.read_to_end(&mut bytes).await.map(|_| bytes)
        });
        let stderr_reader = tokio::spawn(async move {
            let mut bytes = Vec::new();
            stderr.read_to_end(&mut bytes).await.map(|_| bytes)
        });
        let status = tokio::select! {
            status = child.wait() => status?,
            _ = cancellation.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                let _ = stdout_reader.await;
                let _ = stderr_reader.await;
                return Err(AppError::Cancelled);
            }
        };
        let _stdout = stdout_reader
            .await
            .map_err(|error| AppError::EngineError(error.to_string()))??;
        let stderr = stderr_reader
            .await
            .map_err(|error| AppError::EngineError(error.to_string()))??;
        let code = status.code().unwrap_or(-1);
        if status.success() || code == 3 {
            return Ok(());
        }
        let detail = String::from_utf8_lossy(&stderr).trim().to_owned();
        let lower = detail.to_ascii_lowercase();
        if lower.contains("invalid password") {
            return Err(AppError::PasswordIncorrect);
        }
        if lower.contains("password") && lower.contains("required") {
            return Err(AppError::PasswordRequired);
        }
        Err(AppError::EngineError(if detail.is_empty() {
            format!("qpdf exited with status {code}")
        } else {
            detail
        }))
    }
}

fn build_args(operation: &Operation, output: &Path) -> Result<Vec<OsString>, AppError> {
    let mut args = Vec::new();
    match operation {
        Operation::ImagesToPdf { .. }
        | Operation::PdfToImages { .. } => {
            return Err(AppError::InvalidInput(
                "conversion operations do not use qpdf transforms".into(),
            ));
        }
        Operation::Merge { input_paths } => {
            args.extend([OsString::from("--empty"), OsString::from("--pages")]);
            for path in input_paths {
                args.push(path.as_os_str().to_owned());
                args.push(OsString::from("1-z"));
            }
            args.push(OsString::from("--"));
        }
        Operation::Extract { input_path, pages } | Operation::Reorder { input_path, pages } => {
            if pages.trim().is_empty() {
                return Err(AppError::InvalidInput("a page range is required".into()));
            }
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from("--pages"),
                OsString::from("."),
                OsString::from(pages.trim()),
                OsString::from("--"),
            ]);
        }
        Operation::Remove { input_path, pages } => {
            if pages.trim().is_empty() {
                return Err(AppError::InvalidInput("a page range is required".into()));
            }
            let excluded: Vec<String> = pages
                .split(',')
                .map(|part| part.trim())
                .filter(|part| !part.is_empty())
                .map(|part| format!("x{part}"))
                .collect();
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from("--pages"),
                OsString::from("."),
                OsString::from(format!("1-z,{}", excluded.join(","))),
                OsString::from("--"),
            ]);
        }
        Operation::Rotate {
            input_path,
            pages,
            degrees,
        } => {
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from(format!("--rotate=+{degrees}:{}", pages.trim())),
                OsString::from("--"),
            ]);
        }
        Operation::Compress { input_path } => {
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from("--object-streams=generate"),
                OsString::from("--compress-streams=y"),
                OsString::from("--recompress-flate"),
                OsString::from("--compression-level=9"),
                OsString::from("--remove-unreferenced-resources=yes"),
                OsString::from("--"),
            ]);
        }
        Operation::Protect {
            input_path,
            user_password,
            owner_password,
        } => {
            let generated_owner_password;
            let owner_password = if owner_password.is_empty() {
                generated_owner_password = uuid::Uuid::new_v4().to_string();
                &generated_owner_password
            } else {
                owner_password
            };
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from("--encrypt"),
                OsString::from(format!("--user-password={user_password}")),
                OsString::from(format!("--owner-password={owner_password}")),
                OsString::from("--bits=256"),
                OsString::from("--"),
            ]);
        }
        Operation::Unlock {
            input_path,
            password,
        } => {
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from(format!("--password={password}")),
                OsString::from("--decrypt"),
                OsString::from("--"),
            ]);
        }
        Operation::Metadata { input_path } => {
            args.extend([
                input_path.as_os_str().to_owned(),
                OsString::from("--remove-info"),
                OsString::from("--remove-metadata"),
                OsString::from("--"),
            ]);
        }
        Operation::Split { .. } => {
            return Err(AppError::InvalidInput(
                "split uses the multi-output execution path".into(),
            ));
        }
    }
    args.push(output.as_os_str().to_owned());
    Ok(args)
}

fn find_qpdf() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("QPDF_PATH")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
    {
        return Some(path);
    }
    if std::process::Command::new("qpdf")
        .arg("--version")
        .output()
        .is_ok()
    {
        return Some(PathBuf::from("qpdf"));
    }
    #[cfg(windows)]
    if let Some(root) = std::env::var_os("ProgramFiles").map(PathBuf::from)
        && let Ok(entries) = std::fs::read_dir(root)
    {
        let mut candidates: Vec<PathBuf> = entries
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .starts_with("qpdf")
            })
            .map(|entry| entry.path().join("bin").join("qpdf.exe"))
            .filter(|path| path.is_file())
            .collect();
        candidates.sort();
        if let Some(path) = candidates.pop() {
            return Some(path);
        }
    }
    [
        "/opt/homebrew/bin/qpdf",
        "/usr/local/bin/qpdf",
        "/usr/bin/qpdf",
    ]
    .into_iter()
    .map(PathBuf::from)
    .find(|path| path.is_file())
}

fn is_supported_qpdf_version(version: &str) -> bool {
    let version = version.split_whitespace().find(|part| {
        part.chars()
            .next()
            .is_some_and(|character| character.is_ascii_digit())
    });
    let Some(version) = version else { return false };
    let mut numbers = version
        .split('.')
        .filter_map(|part| part.parse::<u32>().ok());
    let major = numbers.next().unwrap_or_default();
    let minor = numbers.next().unwrap_or_default();
    major > 11 || (major == 11 && minor >= 7)
}

#[cfg(test)]
mod tests {
    use super::{QpdfEngine, build_args};
    use crate::jobs::model::Operation;
    use std::ffi::OsString;
    use std::path::{Path, PathBuf};
    use tokio_util::sync::CancellationToken;
    use uuid::Uuid;

    #[test]
    fn builds_remove_pages_arguments_with_exclusion_ranges() {
        let args = build_args(
            &Operation::Remove {
                input_path: PathBuf::from("in.pdf"),
                pages: "2, 5-7".into(),
            },
            Path::new("out.pdf"),
        )
        .unwrap();

        assert_eq!(
            args,
            vec!["in.pdf", "--pages", ".", "1-z,x2,x5-7", "--", "out.pdf"]
        );
    }

    #[test]
    fn builds_merge_arguments_without_a_shell_command() {
        let operation = Operation::Merge {
            input_paths: vec![PathBuf::from("a.pdf"), PathBuf::from("b.pdf")],
        };
        assert_eq!(
            build_args(&operation, Path::new("out.pdf")).unwrap(),
            vec![
                "--empty", "--pages", "a.pdf", "1-z", "b.pdf", "1-z", "--", "out.pdf"
            ]
            .into_iter()
            .map(OsString::from)
            .collect::<Vec<_>>()
        );
    }

    #[test]
    fn builds_aes_256_encryption_arguments() {
        let operation = Operation::Protect {
            input_path: PathBuf::from("a.pdf"),
            user_password: "user pass".into(),
            owner_password: "owner pass".into(),
        };
        let args = build_args(&operation, Path::new("out.pdf")).unwrap();
        assert!(args.contains(&OsString::from("--bits=256")));
        assert!(args.contains(&OsString::from("--user-password=user pass")));
    }

    #[tokio::test]
    async fn qpdf_round_trip_optimizes_protects_and_unlocks_a_pdf() {
        let engine = QpdfEngine::discover_with_bundled(None);
        if engine.require_available().is_err() {
            return;
        }
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        std::fs::create_dir(&dir).unwrap();
        let source = dir.join("source.pdf");
        write_one_page_pdf(&source);
        let cancellation = CancellationToken::new();

        let optimized = dir.join("optimized.pdf");
        engine
            .execute(
                &Operation::Compress { input_path: source },
                &optimized,
                &cancellation,
            )
            .await
            .unwrap();
        engine.verify(&optimized, &cancellation).await.unwrap();

        let extracted = dir.join("extracted.pdf");
        engine
            .execute(
                &Operation::Extract {
                    input_path: optimized.clone(),
                    pages: "1, 1".into(),
                },
                &extracted,
                &cancellation,
            )
            .await
            .unwrap();
        assert_eq!(engine.page_count(&extracted).unwrap(), 1);

        let protected = dir.join("protected.pdf");
        engine
            .execute(
                &Operation::Protect {
                    input_path: optimized,
                    user_password: "test password".into(),
                    owner_password: String::new(),
                },
                &protected,
                &cancellation,
            )
            .await
            .unwrap();
        engine
            .verify_with_password(&protected, Some("test password"), &cancellation)
            .await
            .unwrap();

        let unlocked = dir.join("unlocked.pdf");
        engine
            .execute(
                &Operation::Unlock {
                    input_path: protected,
                    password: "test password".into(),
                },
                &unlocked,
                &cancellation,
            )
            .await
            .unwrap();
        engine.verify(&unlocked, &cancellation).await.unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }

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
        std::fs::write(path, bytes).unwrap();
    }
}
