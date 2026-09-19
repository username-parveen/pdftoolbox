use std::path::PathBuf;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;
use crate::filesystem::prepare_output_directory as prepare_directory;
use crate::jobs::engine::JobEngine;
use crate::jobs::model::{JobRecord, JobRequest};
use crate::pdf::pdfium_engine::PdfiumEngine;
use crate::pdf::qpdf_engine::{EngineCapabilities, QpdfEngine};

#[derive(Clone, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: String,
}

#[derive(serde::Serialize, Clone)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub release_url: String,
    pub release_notes: String,
}

fn parse_github_repo(repository: &str) -> Option<(String, String)> {
    let trimmed = repository.trim_end_matches('/');
    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() >= 2 {
        Some((parts[parts.len() - 2].to_string(), parts[parts.len() - 1].to_string()))
    } else {
        None
    }
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_parts = |s: &str| -> Option<Vec<u64>> {
        s.trim_start_matches('v')
            .split('.')
            .filter_map(|p| p.split('-').next().and_then(|s| s.parse::<u64>().ok()))
            .collect::<Vec<_>>()
            .into()
    };
    let latest_parts = parse_parts(latest);
    let current_parts = parse_parts(current);
    match (latest_parts, current_parts) {
        (Some(l), Some(c)) => {
            let max = l.len().max(c.len());
            for i in 0..max {
                let lv = l.get(i).copied().unwrap_or(0);
                let cv = c.get(i).copied().unwrap_or(0);
                if lv > cv { return true; }
                if lv < cv { return false; }
            }
            false
        }
        _ => latest != current,
    }
}

#[tauri::command]
pub fn get_capabilities(
    qpdf: State<'_, QpdfEngine>,
    _pdfium: State<'_, PdfiumEngine>,
) -> EngineCapabilities {
    let mut capabilities = qpdf.capabilities();
    capabilities.pdfium = true;
    capabilities.elevated = process_is_elevated();
    capabilities
}

#[cfg(windows)]
fn process_is_elevated() -> bool {
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{
        GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation: TOKEN_ELEVATION = zeroed();
        let mut returned = 0;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            (&mut elevation as *mut TOKEN_ELEVATION).cast(),
            size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        );
        CloseHandle(token);
        result != 0 && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
fn process_is_elevated() -> bool {
    false
}

#[tauri::command]
pub async fn start_job(
    request: JobRequest,
    app: AppHandle,
    engine: State<'_, JobEngine>,
) -> Result<JobRecord, AppError> {
    engine.start(request, app)
}

#[tauri::command]
pub fn list_jobs(engine: State<'_, JobEngine>) -> Vec<JobRecord> {
    engine.list()
}

#[tauri::command]
pub fn cancel_job(id: String, engine: State<'_, JobEngine>) -> Result<(), AppError> {
    engine.cancel(&id)
}

#[tauri::command]
pub fn clear_finished_jobs(engine: State<'_, JobEngine>) {
    engine.clear_finished();
}

#[tauri::command(async)]
pub fn get_default_output_directory(app: AppHandle) -> Result<PathBuf, AppError> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| AppError::IoError(error.to_string()))?;
    prepare_directory(&downloads.join("PDF Toolbox"))
}

#[tauri::command(async)]
pub fn prepare_output_directory(path: PathBuf) -> Result<PathBuf, AppError> {
    prepare_directory(&path)
}

#[tauri::command(async)]
pub fn open_job_output(
    job_id: String,
    output_path: PathBuf,
    app: AppHandle,
    engine: State<'_, JobEngine>,
) -> Result<(), AppError> {
    let authorized = engine.authorize_completed_output_path(&job_id, &output_path)?;
    let authorized = authorized.to_str().ok_or_else(|| {
        AppError::InvalidInput("output path cannot be represented as Unicode".into())
    })?;
    app.opener()
        .open_path(authorized, None::<&str>)
        .map_err(|error| AppError::IoError(format!("could not open job output: {error}")))
}

#[tauri::command(async)]
pub fn reveal_job_output(
    job_id: String,
    output_path: PathBuf,
    app: AppHandle,
    engine: State<'_, JobEngine>,
) -> Result<(), AppError> {
    let authorized = engine.authorize_completed_output_path(&job_id, &output_path)?;
    app.opener()
        .reveal_item_in_dir(authorized)
        .map_err(|error| AppError::IoError(format!("could not reveal job output: {error}")))
}

#[tauri::command(async)]
pub fn check_for_update() -> Result<Option<UpdateInfo>, AppError> {
    let repository = env!("CARGO_PKG_REPOSITORY");
    let (owner, repo) = parse_github_repo(repository)
        .ok_or_else(|| AppError::UpdateError("GitHub repository is not configured".into()))?;
    let url = format!("https://api.github.com/repos/{owner}/{repo}/releases/latest");
    let response = reqwest::blocking::Client::new()
        .get(&url)
        .header("User-Agent", "PDF Toolbox")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .map_err(|e| AppError::UpdateError(format!("network error: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::UpdateError(format!(
            "GitHub API returned status {}",
            response.status()
        )));
    }
    let release: GitHubRelease = response
        .json()
        .map_err(|e| AppError::UpdateError(format!("response parse error: {e}")))?;
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    if is_newer_version(&release.tag_name, &current_version) {
        Ok(Some(UpdateInfo {
            current_version,
            latest_version: release.tag_name,
            release_url: release.html_url,
            release_notes: release.body,
        }))
    } else {
        Ok(None)
    }
}
