use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::AppError;
use crate::filesystem::{
    atomic_commit, ensure_directory_writable, resolve_output_path, temporary_output_path,
};
use crate::jobs::model::{ConflictResolution, JobRecord, JobRequest, JobState, Operation};
use crate::page_range::parse_page_range;
use crate::pdf::image_pdf::{create_pdf_from_images_with_progress, validate_image_inputs};
use crate::pdf::pdfium_engine::PdfiumEngine;
use crate::pdf::qpdf_engine::QpdfEngine;

#[derive(Clone)]
pub struct JobEngine {
    jobs: Arc<Mutex<HashMap<String, JobRecord>>>,
    cancellations: Arc<Mutex<HashMap<String, CancellationToken>>>,
    workers: Arc<Semaphore>,
    qpdf: QpdfEngine,
    pdfium: PdfiumEngine,
}

impl JobEngine {
    pub fn new(qpdf: QpdfEngine, pdfium: PdfiumEngine) -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            cancellations: Arc::new(Mutex::new(HashMap::new())),
            workers: Arc::new(Semaphore::new(2)),
            qpdf,
            pdfium,
        }
    }

    pub fn start(&self, request: JobRequest, app: AppHandle) -> Result<JobRecord, AppError> {
        match &request.operation {
            Operation::ImagesToPdf { input_paths } => validate_image_inputs(input_paths)?,
            Operation::PdfToImages {
                input_path, dpi, ..
            } => {
                validate_pdfium_input(input_path, *dpi)?;
                self.pdfium.page_count(input_path)?;
            }
            operation => self.qpdf.validate_operation(operation)?,
        }
        validate_output(&request.output_path, &request.operation)?;

        let id = Uuid::new_v4().to_string();
        let record = JobRecord::queued(id.clone(), request.operation.tool_name());
        let cancellation = CancellationToken::new();
        lock(&self.jobs).insert(id.clone(), record.clone());
        lock(&self.cancellations).insert(id.clone(), cancellation.clone());

        let engine = self.clone();
        tauri::async_runtime::spawn(async move {
            engine.process(id, request, cancellation, app).await;
        });
        Ok(record)
    }

    pub fn list(&self) -> Vec<JobRecord> {
        let mut jobs: Vec<JobRecord> = lock(&self.jobs).values().cloned().collect();
        jobs.sort_by(|left, right| right.id.cmp(&left.id));
        jobs
    }

    pub fn cancel(&self, id: &str) -> Result<(), AppError> {
        let token = lock(&self.cancellations).get(id).cloned().ok_or_else(|| {
            AppError::InvalidInput("job was not found or has already finished".into())
        })?;
        token.cancel();
        Ok(())
    }

    pub fn clear_finished(&self) {
        lock(&self.jobs).retain(|_, job| matches!(job.state, JobState::Queued | JobState::Running));
    }

    pub fn authorize_completed_output_path(
        &self,
        id: &str,
        output_path: &Path,
    ) -> Result<PathBuf, AppError> {
        let job = lock(&self.jobs).get(id).cloned();
        authorize_completed_output(job.as_ref(), output_path)
    }

    async fn process(
        &self,
        id: String,
        request: JobRequest,
        cancellation: CancellationToken,
        app: AppHandle,
    ) {
        let permit = tokio::select! {
            permit = self.workers.acquire() => permit,
            _ = cancellation.cancelled() => {
                self.finish_error(&id, AppError::Cancelled, &app);
                return;
            }
        };
        let Ok(_permit) = permit else {
            self.finish_error(
                &id,
                AppError::EngineError("job worker pool closed".into()),
                &app,
            );
            return;
        };

        self.update(&id, &app, |job| {
            job.state = JobState::Running;
            job.current_step = 1;
            job.message = if matches!(
                request.operation,
                Operation::ImagesToPdf { .. }
                    | Operation::PdfToImages { .. }
            ) {
                "Processing with PDFium".into()
            } else {
                "Processing with qpdf".into()
            };
        });

        let result = match &request.operation {
            Operation::ImagesToPdf { .. } => {
                self.process_images_to_pdf(&request, &cancellation, &id, &app)
                    .await
            }
            Operation::PdfToImages { .. } => {
                self.process_pdf_to_images(&request, &cancellation, &id, &app)
                    .await
            }
            Operation::Split { input_path, every } => {
                self.process_split(input_path, *every, &request, &cancellation, &id, &app)
                    .await
            }
            operation => {
                self.process_single(operation, &request, &cancellation, &id, &app)
                    .await
            }
        };

        match result.and_then(|outputs| {
            let canonical_outputs = canonicalize_output_paths(&outputs)?;
            Ok((outputs, canonical_outputs))
        }) {
            Ok((outputs, canonical_outputs)) => self.update(&id, &app, |job| {
                job.state = JobState::Completed;
                job.current_step = job.total_steps;
                job.message = if outputs.len() == 1 {
                    "Output saved".into()
                } else {
                    format!("{} outputs saved", outputs.len())
                };
                job.output_paths = outputs;
                job.canonical_output_paths = canonical_outputs;
            }),
            Err(error) => self.finish_error(&id, error, &app),
        }
        lock(&self.cancellations).remove(&id);
    }

    async fn process_single(
        &self,
        operation: &Operation,
        request: &JobRequest,
        cancellation: &CancellationToken,
        id: &str,
        app: &AppHandle,
    ) -> Result<Vec<PathBuf>, AppError> {
        let final_path = resolve_output_path(&request.output_path, request.conflict)?;
        let temp_path = temporary_output_path(&final_path)?;
        let result = async {
            self.qpdf
                .execute(operation, &temp_path, cancellation)
                .await?;
            self.update(id, app, |job| {
                job.current_step = 2;
                job.message = "Verifying PDF integrity".into();
            });
            if let Operation::Protect { user_password, .. } = operation {
                self.qpdf
                    .verify_with_password(&temp_path, Some(user_password), cancellation)
                    .await?;
            } else {
                self.qpdf.verify(&temp_path, cancellation).await?;
            }
            if cancellation.is_cancelled() {
                return Err(AppError::Cancelled);
            }
            let committed = commit_output(&temp_path, &request.output_path, request.conflict)?;
            Ok(vec![committed])
        }
        .await;
        if result.is_err() {
            let _ = fs::remove_file(temp_path);
        }
        result
    }

    async fn process_images_to_pdf(
        &self,
        request: &JobRequest,
        cancellation: &CancellationToken,
        id: &str,
        app: &AppHandle,
    ) -> Result<Vec<PathBuf>, AppError> {
        let Operation::ImagesToPdf { input_paths } = &request.operation else {
            return Err(AppError::EngineError("invalid image conversion job".into()));
        };
        let final_path = resolve_output_path(&request.output_path, request.conflict)?;
        let temp_path = temporary_output_path(&final_path)?;
        let inputs = input_paths.clone();
        let updates = self.clone();
        let app_handle = app.clone();
        let job_id = id.to_owned();
        let conversion_cancellation = cancellation.clone();
        let temp_output = temp_path.clone();
        let created = tokio::task::spawn_blocking(move || {
            create_pdf_from_images_with_progress(&inputs, &temp_output, |current, total| {
                if conversion_cancellation.is_cancelled() {
                    return Err(AppError::Cancelled);
                }
                updates.update(&job_id, &app_handle, |job| {
                    job.current_step = current;
                    job.total_steps = total.max(1) + 1;
                    job.message =
                        format!("Embedded image {current} of {total} without recompression");
                });
                Ok(())
            })
        })
        .await
        .map_err(|error| AppError::EngineError(error.to_string()))?;
        if let Err(error) = created {
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }
        if cancellation.is_cancelled() {
            let _ = fs::remove_file(&temp_path);
            return Err(AppError::Cancelled);
        }
        self.update(id, app, |job| {
            job.current_step = job.total_steps.saturating_sub(1);
            job.message = "Verifying generated PDF".into();
        });
        self.qpdf.verify(&temp_path, cancellation).await?;
        if cancellation.is_cancelled() {
            let _ = fs::remove_file(&temp_path);
            return Err(AppError::Cancelled);
        }
        let committed = commit_output(&temp_path, &request.output_path, request.conflict)?;
        Ok(vec![committed])
    }

    async fn process_pdf_to_images(
        &self,
        request: &JobRequest,
        cancellation: &CancellationToken,
        id: &str,
        app: &AppHandle,
    ) -> Result<Vec<PathBuf>, AppError> {
        let Operation::PdfToImages {
            input_path,
            format,
            dpi,
            page_range,
        } = &request.operation
        else {
            return Err(AppError::EngineError("invalid PDFium image job".into()));
        };
        let temp_dir = request
            .output_path
            .join(format!(".images.tmp.{}", Uuid::new_v4()));
        fs::create_dir(&temp_dir)?;
        let page_numbers = self.selected_pages(input_path, page_range.as_deref())?;
        let engine = self.pdfium.clone();
        let input_path = input_path.clone();
        let render_dir = temp_dir.clone();
        let format = *format;
        let dpi = *dpi;
        let updates = self.clone();
        let app_handle = app.clone();
        let job_id = id.to_owned();
        let render_cancellation = cancellation.clone();
        let rendered = tokio::task::spawn_blocking(move || {
            engine.render_pages(
                &input_path,
                &render_dir,
                format,
                dpi,
                &page_numbers,
                |current, total| {
                    if render_cancellation.is_cancelled() {
                        return Err(AppError::Cancelled);
                    }
                    updates.update(&job_id, &app_handle, |job| {
                        job.current_step = current;
                        job.total_steps = total.max(1);
                        job.message = format!("Rendered page {current} of {total}");
                    });
                    Ok(())
                },
            )
        })
        .await
        .map_err(|error| AppError::EngineError(error.to_string()))?;
        let result = match rendered {
            Ok(_) if cancellation.is_cancelled() => Err(AppError::Cancelled),
            Ok(rendered) => {
                let plans = rendered
                    .into_iter()
                    .map(|path| {
                        let requested = request
                            .output_path
                            .join(path.file_name().unwrap_or_default());
                        (path, requested)
                    })
                    .collect();
                commit_split_outputs(plans, request.conflict, cancellation)
            }
            Err(error) => Err(error),
        };
        match fs::remove_dir_all(&temp_dir) {
            Ok(()) => result,
            Err(cleanup_error) => Err(AppError::IoError(format!(
                "{}; temporary images at {} could not be removed: {cleanup_error}",
                result
                    .err()
                    .unwrap_or_else(|| AppError::IoError("images were saved".into())),
                temp_dir.display()
            ))),
        }
    }

    fn selected_pages(
        &self,
        input_path: &Path,
        page_range: Option<&str>,
    ) -> Result<Vec<u32>, AppError> {
        let Some(page_range) = page_range.filter(|range| !range.trim().is_empty()) else {
            return Ok(Vec::new());
        };
        parse_page_range(page_range, self.pdfium.page_count(input_path)?, false)
            .map_err(AppError::InvalidInput)
    }

    async fn process_split(
        &self,
        input_path: &Path,
        every: u32,
        request: &JobRequest,
        cancellation: &CancellationToken,
        id: &str,
        app: &AppHandle,
    ) -> Result<Vec<PathBuf>, AppError> {
        let parent = request.output_path.parent().ok_or_else(|| {
            AppError::OutputNotWritable(request.output_path.display().to_string())
        })?;
        let temp_dir = parent.join(format!(".split.tmp.{}", Uuid::new_v4()));
        fs::create_dir(&temp_dir)?;
        let pattern = temp_dir.join("part-%d.pdf");

        let result = async {
            self.qpdf
                .execute_split(input_path, every, &pattern, cancellation)
                .await?;
            let mut parts: Vec<PathBuf> = fs::read_dir(&temp_dir)?
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| {
                    path.extension()
                        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
                })
                .collect();
            parts.sort();
            if parts.is_empty() {
                return Err(AppError::EngineError("qpdf produced no split files".into()));
            }

            self.update(id, app, |job| {
                job.total_steps = parts.len() as u32 + 2;
                job.message = format!("Preparing to verify {} output files", parts.len());
            });
            let stem = request
                .output_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("split");
            let mut plans = Vec::with_capacity(parts.len());
            for (index, part) in parts.into_iter().enumerate() {
                self.qpdf.verify(&part, cancellation).await?;
                self.update(id, app, |job| {
                    job.current_step = index as u32 + 2;
                    job.message = format!("Verified file {}", index + 1);
                });
                let suffix = part
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .and_then(|value| value.strip_prefix("part-"))
                    .unwrap_or("part");
                let requested = parent.join(format!("{stem}-{suffix}.pdf"));
                plans.push((part, requested));
            }
            commit_split_outputs(plans, request.conflict, cancellation)
        }
        .await;
        match fs::remove_dir_all(&temp_dir) {
            Ok(()) => result,
            Err(cleanup_error) => Err(AppError::IoError(match result {
                Ok(_) => format!(
                    "split outputs were saved, but temporary files at {} could not be removed: {cleanup_error}",
                    temp_dir.display()
                ),
                Err(error) => format!(
                    "{error}; temporary files at {} also could not be removed: {cleanup_error}",
                    temp_dir.display()
                ),
            })),
        }
    }

    fn finish_error(&self, id: &str, error: AppError, app: &AppHandle) {
        self.update(id, app, |job| {
            let cancelled = matches!(error, AppError::Cancelled);
            job.state = if cancelled {
                JobState::Cancelled
            } else {
                JobState::Failed
            };
            job.message = if cancelled {
                "Cancelled".into()
            } else {
                "Operation failed".into()
            };
            job.error = if cancelled {
                None
            } else {
                Some(error.to_string())
            };
        });
        lock(&self.cancellations).remove(id);
    }

    fn update(&self, id: &str, app: &AppHandle, change: impl FnOnce(&mut JobRecord)) {
        let record = {
            let mut jobs = lock(&self.jobs);
            let Some(job) = jobs.get_mut(id) else { return };
            change(job);
            job.clone()
        };
        let _ = app.emit("job://updated", record);
    }
}

fn validate_output(path: &Path, operation: &Operation) -> Result<(), AppError> {
    if matches!(operation, Operation::PdfToImages { .. }) {
        return ensure_directory_writable(path);
    }
    let parent = path
        .parent()
        .filter(|parent| parent.is_dir())
        .ok_or_else(|| AppError::OutputNotWritable(path.display().to_string()))?;
    let expected_extension = "pdf";
    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case(expected_extension))
    {
        return Err(AppError::InvalidInput(format!(
            "output must use the .{expected_extension} extension"
        )));
    }
    ensure_directory_writable(parent)
}

fn validate_pdfium_input(path: &Path, dpi: u16) -> Result<(), AppError> {
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
    if !(72..=600).contains(&dpi) {
        return Err(AppError::InvalidInput(
            "DPI must be between 72 and 600".into(),
        ));
    }
    Ok(())
}

fn commit_output(
    temp_path: &Path,
    requested: &Path,
    conflict: ConflictResolution,
) -> Result<PathBuf, AppError> {
    loop {
        let destination = resolve_output_path(requested, conflict)?;
        match atomic_commit(
            temp_path,
            &destination,
            conflict == ConflictResolution::Overwrite,
        ) {
            Ok(()) => return Ok(destination),
            Err(AppError::OutputExists(_)) if conflict == ConflictResolution::AutoRename => {}
            Err(error) => return Err(error),
        }
    }
}

fn commit_split_outputs(
    plans: Vec<(PathBuf, PathBuf)>,
    conflict: ConflictResolution,
    cancellation: &CancellationToken,
) -> Result<Vec<PathBuf>, AppError> {
    if conflict == ConflictResolution::Skip {
        for (_, requested) in &plans {
            resolve_output_path(requested, conflict)?;
        }
    }

    let mut backups = Vec::new();
    if conflict == ConflictResolution::Overwrite {
        for (_, requested) in &plans {
            if requested.exists() {
                let backup = temporary_output_path(requested)?;
                if let Err(error) = fs::rename(requested, &backup) {
                    let cleanup_errors = restore_backups(&backups);
                    return Err(with_cleanup_errors(error.into(), cleanup_errors));
                }
                backups.push((requested.clone(), backup));
            }
        }
    }

    let mut outputs = Vec::with_capacity(plans.len());
    for (part, requested) in plans {
        let result = if cancellation.is_cancelled() {
            Err(AppError::Cancelled)
        } else {
            commit_output(&part, &requested, conflict)
        };
        match result {
            Ok(output) => outputs.push(output),
            Err(error) => {
                let cleanup_errors = rollback_split(&outputs, &backups);
                return Err(with_cleanup_errors(error, cleanup_errors));
            }
        }
    }
    let mut cleanup_errors = Vec::new();
    for (_, backup) in &backups {
        if let Err(error) = fs::remove_file(backup) {
            cleanup_errors.push(format!(
                "could not remove backup {}: {error}",
                backup.display()
            ));
        }
    }
    if !cleanup_errors.is_empty() {
        return Err(AppError::IoError(format!(
            "split outputs were saved, but cleanup was incomplete: {}",
            cleanup_errors.join("; ")
        )));
    }
    Ok(outputs)
}

fn rollback_split(outputs: &[PathBuf], backups: &[(PathBuf, PathBuf)]) -> Vec<String> {
    let mut errors = Vec::new();
    for output in outputs {
        if let Err(error) = fs::remove_file(output) {
            errors.push(format!(
                "could not remove partial output {}: {error}",
                output.display()
            ));
        }
    }
    errors.extend(restore_backups(backups));
    errors
}

fn restore_backups(backups: &[(PathBuf, PathBuf)]) -> Vec<String> {
    let mut errors = Vec::new();
    for (destination, backup) in backups.iter().rev() {
        if destination.exists()
            && let Err(error) = fs::remove_file(destination)
        {
            errors.push(format!(
                "could not clear {} before restoring its backup: {error}",
                destination.display()
            ));
            continue;
        }
        if let Err(error) = fs::rename(backup, destination) {
            errors.push(format!(
                "could not restore backup {} to {}: {error}",
                backup.display(),
                destination.display()
            ));
        }
    }
    errors
}

fn with_cleanup_errors(error: AppError, cleanup_errors: Vec<String>) -> AppError {
    if cleanup_errors.is_empty() {
        error
    } else {
        AppError::IoError(format!(
            "{error}; rollback was incomplete: {}",
            cleanup_errors.join("; ")
        ))
    }
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn authorize_completed_output(
    job: Option<&JobRecord>,
    output_path: &Path,
) -> Result<PathBuf, AppError> {
    let job = job.ok_or_else(|| AppError::InvalidInput("job was not found".into()))?;
    if job.state != JobState::Completed {
        return Err(AppError::InvalidInput(
            "result actions require a completed job".into(),
        ));
    }

    let requested = canonicalize_output_file(output_path)?;

    job.output_paths
        .iter()
        .zip(&job.canonical_output_paths)
        .find(|(recorded, canonical)| {
            recorded.is_file()
                && canonical.is_file()
                && canonical.as_path() == requested.as_path()
        })
        .map(|(_, canonical)| canonical.clone())
        .ok_or_else(|| {
            AppError::InvalidInput("output path does not belong to the completed job".into())
        })
}

fn canonicalize_output_paths(output_paths: &[PathBuf]) -> Result<Vec<PathBuf>, AppError> {
    output_paths
        .iter()
        .map(|path| canonicalize_output_file(path))
        .collect()
}

fn canonicalize_output_file(path: &Path) -> Result<PathBuf, AppError> {
    let canonical = fs::canonicalize(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            AppError::FileNotFound(path.display().to_string())
        } else {
            AppError::IoError(error.to_string())
        }
    })?;
    if !canonical.is_file() {
        return Err(AppError::InvalidInput(
            "job output must be an existing file".into(),
        ));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::authorize_completed_output;
    use crate::jobs::model::{JobRecord, JobState};
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn job(id: &str, state: JobState, output_paths: Vec<PathBuf>) -> JobRecord {
        let canonical_output_paths = output_paths
            .iter()
            .filter_map(|path| fs::canonicalize(path).ok())
            .collect();
        JobRecord {
            id: id.into(),
            tool: "Test".into(),
            state,
            current_step: 1,
            total_steps: 1,
            message: "Test job".into(),
            output_paths,
            canonical_output_paths,
            error: None,
        }
    }

    #[test]
    fn authorizes_a_canonical_equivalent_completed_output_path() {
        let root = std::env::temp_dir().join(Uuid::new_v4().to_string());
        let nested = root.join("nested");
        fs::create_dir_all(&nested).unwrap();
        let output = root.join("result.pdf");
        fs::write(&output, b"output").unwrap();
        let equivalent = nested.join("..").join("result.pdf");
        let jobs: HashMap<String, JobRecord> = HashMap::from([(
            "completed".into(),
            job("completed", JobState::Completed, vec![output.clone()]),
        )]);

        let authorized =
            authorize_completed_output(jobs.get("completed"), &equivalent).unwrap();

        assert_eq!(authorized, fs::canonicalize(&output).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_outputs_from_jobs_that_are_not_completed() {
        let root = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&root).unwrap();
        let output = root.join("result.pdf");
        fs::write(&output, b"output").unwrap();

        for state in [
            JobState::Queued,
            JobState::Running,
            JobState::Failed,
            JobState::Cancelled,
        ] {
            let jobs: HashMap<String, JobRecord> =
                HashMap::from([("job".into(), job("job", state, vec![output.clone()]))]);
            let error = authorize_completed_output(jobs.get("job"), &output).unwrap_err();
            assert!(matches!(error, crate::error::AppError::InvalidInput(_)));
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unknown_jobs_and_outputs_from_other_completed_jobs() {
        let root = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&root).unwrap();
        let output = root.join("result.pdf");
        let other = root.join("other.pdf");
        fs::write(&output, b"output").unwrap();
        fs::write(&other, b"other").unwrap();
        let jobs: HashMap<String, JobRecord> = HashMap::from([(
            "completed".into(),
            job("completed", JobState::Completed, vec![output]),
        )]);

        let unknown = authorize_completed_output(jobs.get("missing"), &other).unwrap_err();
        let foreign = authorize_completed_output(jobs.get("completed"), &other).unwrap_err();

        assert!(matches!(unknown, crate::error::AppError::InvalidInput(_)));
        assert!(matches!(foreign, crate::error::AppError::InvalidInput(_)));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_a_nonexistent_completed_output() {
        let missing = std::env::temp_dir()
            .join(Uuid::new_v4().to_string())
            .join("missing.pdf");
        let jobs: HashMap<String, JobRecord> = HashMap::from([(
            "completed".into(),
            job("completed", JobState::Completed, vec![missing.clone()]),
        )]);

        let error = authorize_completed_output(jobs.get("completed"), &missing).unwrap_err();

        assert!(matches!(error, crate::error::AppError::FileNotFound(_)));
    }
}
