use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::pdf::pdfium_engine::RenderFormat;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    AutoRename,
    Overwrite,
    Skip,
}

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Operation {
    Merge {
        input_paths: Vec<PathBuf>,
    },
    Extract {
        input_path: PathBuf,
        pages: String,
    },
    Remove {
        input_path: PathBuf,
        pages: String,
    },
    Reorder {
        input_path: PathBuf,
        pages: String,
    },
    Rotate {
        input_path: PathBuf,
        pages: String,
        degrees: u16,
    },
    Split {
        input_path: PathBuf,
        every: u32,
    },
    ImagesToPdf {
        input_paths: Vec<PathBuf>,
    },
    PdfToImages {
        input_path: PathBuf,
        format: RenderFormat,
        dpi: u16,
        page_range: Option<String>,
    },
    Compress {
        input_path: PathBuf,
    },
    Protect {
        input_path: PathBuf,
        user_password: String,
        owner_password: String,
    },
    Unlock {
        input_path: PathBuf,
        password: String,
    },
    Metadata {
        input_path: PathBuf,
    },
}

impl Operation {
    pub fn tool_name(&self) -> &'static str {
        match self {
            Self::Merge { .. } => "Merge PDFs",
            Self::Extract { .. } => "Extract pages",
            Self::Remove { .. } => "Remove pages",
            Self::Reorder { .. } => "Reorder pages",
            Self::Rotate { .. } => "Rotate pages",
            Self::Split { .. } => "Split PDF",
            Self::ImagesToPdf { .. } => "Images to PDF",
            Self::PdfToImages { .. } => "PDF to images",
            Self::Compress { .. } => "Lossless optimize",
            Self::Protect { .. } => "Protect PDF",
            Self::Unlock { .. } => "Unlock PDF",
            Self::Metadata { .. } => "Reduce metadata",
        }
    }

    pub fn input_paths(&self) -> Vec<&Path> {
        match self {
            Self::Merge { input_paths } => input_paths.iter().map(PathBuf::as_path).collect(),
            Self::ImagesToPdf { input_paths } => input_paths.iter().map(PathBuf::as_path).collect(),
            Self::PdfToImages { input_path, .. } => vec![input_path],
            Self::Extract { input_path, .. }
            | Self::Remove { input_path, .. }
            | Self::Reorder { input_path, .. }
            | Self::Rotate { input_path, .. }
            | Self::Split { input_path, .. }
            | Self::Compress { input_path }
            | Self::Protect { input_path, .. }
            | Self::Unlock { input_path, .. }
            | Self::Metadata { input_path } => vec![input_path],
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRequest {
    pub operation: Operation,
    pub output_path: PathBuf,
    pub conflict: ConflictResolution,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum JobState {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub tool: String,
    pub state: JobState,
    pub current_step: u32,
    pub total_steps: u32,
    pub message: String,
    pub output_paths: Vec<PathBuf>,
    #[serde(skip)]
    pub(crate) canonical_output_paths: Vec<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl JobRecord {
    pub fn queued(id: String, tool: &str) -> Self {
        Self {
            id,
            tool: tool.into(),
            state: JobState::Queued,
            current_step: 0,
            total_steps: 3,
            message: "Waiting for an available worker".into(),
            output_paths: Vec::new(),
            canonical_output_paths: Vec::new(),
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::JobRecord;
    use std::path::PathBuf;

    #[test]
    fn canonical_authorization_paths_are_not_serialized_over_ipc() {
        let mut job = JobRecord::queued("job-id".into(), "Test");
        job.output_paths = vec![PathBuf::from("C:\\output.pdf")];
        job.canonical_output_paths = vec![PathBuf::from("\\\\?\\C:\\output.pdf")];

        let serialized = serde_json::to_value(job).unwrap();

        assert_eq!(serialized["outputPaths"][0], "C:\\output.pdf");
        assert!(serialized.get("canonicalOutputPaths").is_none());
    }
}
