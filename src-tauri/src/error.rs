use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Clone, Error, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("File is locked or inaccessible: {0}")]
    FileLocked(String),
    #[error("Destination output is not writable: {0}")]
    OutputNotWritable(String),
    #[error("Output already exists: {0}")]
    OutputExists(String),
    #[error("PDF is password protected")]
    PasswordRequired,
    #[error("Invalid password provided")]
    PasswordIncorrect,
    #[error("PDF document is corrupted or malformed: {0}")]
    PdfCorrupt(String),
    #[error("Engine execution failed: {0}")]
    EngineError(String),
    #[error("Operation cancelled by user")]
    Cancelled,
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("I/O error: {0}")]
    IoError(String),
    #[error("Update check failed: {0}")]
    UpdateError(String),
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::IoError(error.to_string())
    }
}
