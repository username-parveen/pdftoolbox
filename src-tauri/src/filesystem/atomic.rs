use std::io::Write;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::error::AppError;
use crate::jobs::model::ConflictResolution;

pub fn ensure_directory_writable(directory: &Path) -> Result<(), AppError> {
    if !directory.is_dir() {
        return Err(AppError::OutputNotWritable(format!(
            "{} is not an accessible folder",
            directory.display()
        )));
    }
    let probe = directory.join(format!(".pdf-toolbox-write-test-{}.tmp", Uuid::new_v4()));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|error| permission_error(directory, &error))?;
    if let Err(error) = file.write_all(b"write-test") {
        drop(file);
        let _ = std::fs::remove_file(&probe);
        return Err(permission_error(directory, &error));
    }
    drop(file);
    std::fs::remove_file(&probe).map_err(|error| {
        AppError::OutputNotWritable(format!(
            "{} allows file creation but not cleanup ({error}); remove {} manually and choose another folder",
            directory.display(),
            probe.display()
        ))
    })?;
    Ok(())
}

pub fn prepare_output_directory(directory: &Path) -> Result<PathBuf, AppError> {
    if !directory.is_absolute() {
        return Err(AppError::InvalidInput(
            "output directory must be an absolute path".into(),
        ));
    }
    if directory.exists() && !directory.is_dir() {
        return Err(AppError::OutputNotWritable(format!(
            "{} is not a folder",
            directory.display()
        )));
    }

    std::fs::create_dir_all(directory).map_err(|error| permission_error(directory, &error))?;
    if !directory.is_dir() {
        return Err(AppError::OutputNotWritable(format!(
            "{} is not an accessible folder",
            directory.display()
        )));
    }
    ensure_directory_writable(directory)?;
    Ok(directory.to_path_buf())
}

fn permission_error(directory: &Path, error: &std::io::Error) -> AppError {
    AppError::OutputNotWritable(format!(
        "Windows denied write access to {} ({error}). Choose a user-writable folder; do not save directly under C:\\ or protected system folders",
        directory.display()
    ))
}

pub fn temporary_output_path(final_path: &Path) -> Result<PathBuf, AppError> {
    let parent = final_path
        .parent()
        .filter(|path| path.exists())
        .ok_or_else(|| AppError::OutputNotWritable(final_path.display().to_string()))?;
    let name = final_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::InvalidInput("output must have a file name".into()))?;
    Ok(parent.join(format!(".{name}.tmp.{}", Uuid::new_v4())))
}

pub fn resolve_output_path(
    requested: &Path,
    conflict: ConflictResolution,
) -> Result<PathBuf, AppError> {
    if !requested.exists() {
        return Ok(requested.to_path_buf());
    }
    match conflict {
        ConflictResolution::Overwrite => Ok(requested.to_path_buf()),
        ConflictResolution::Skip => Err(AppError::OutputExists(requested.display().to_string())),
        ConflictResolution::AutoRename => {
            let parent = requested.parent().unwrap_or_else(|| Path::new("."));
            let stem = requested
                .file_stem()
                .and_then(|v| v.to_str())
                .unwrap_or("output");
            let extension = requested.extension().and_then(|v| v.to_str());
            for index in 1..10_000 {
                let name = match extension {
                    Some(extension) => format!("{stem} ({index}).{extension}"),
                    None => format!("{stem} ({index})"),
                };
                let candidate = parent.join(name);
                if !candidate.exists() {
                    return Ok(candidate);
                }
            }
            Err(AppError::OutputNotWritable(
                "could not find an available output name".into(),
            ))
        }
    }
}

pub fn atomic_commit(temp_path: &Path, final_path: &Path, overwrite: bool) -> Result<(), AppError> {
    if final_path.exists() && !overwrite {
        return Err(AppError::OutputExists(final_path.display().to_string()));
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{
            MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
        };

        let source: Vec<u16> = temp_path.as_os_str().encode_wide().chain(Some(0)).collect();
        let destination: Vec<u16> = final_path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        let flags = MOVEFILE_WRITE_THROUGH
            | if overwrite {
                MOVEFILE_REPLACE_EXISTING
            } else {
                0
            };
        let result = unsafe { MoveFileExW(source.as_ptr(), destination.as_ptr(), flags) };
        if result == 0 {
            if final_path.exists() && !overwrite {
                return Err(AppError::OutputExists(final_path.display().to_string()));
            }
            return Err(std::io::Error::last_os_error().into());
        }
    }

    #[cfg(not(windows))]
    if overwrite {
        std::fs::rename(temp_path, final_path)?;
    } else {
        std::fs::hard_link(temp_path, final_path).map_err(|error| {
            if final_path.exists() {
                AppError::OutputExists(final_path.display().to_string())
            } else {
                error.into()
            }
        })?;
        std::fs::remove_file(temp_path)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        atomic_commit, ensure_directory_writable, prepare_output_directory, resolve_output_path,
        temporary_output_path,
    };
    use crate::jobs::model::ConflictResolution;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn creates_hidden_unique_temp_path_next_to_destination() {
        let dir = std::env::temp_dir();
        let final_path = dir.join("report.pdf");
        let temp = temporary_output_path(&final_path).unwrap();
        assert_eq!(temp.parent(), final_path.parent());
        assert!(
            temp.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with(".report.pdf.tmp.")
        );
    }

    #[test]
    fn auto_renames_an_existing_output() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let requested = dir.join("report.pdf");
        fs::write(&requested, b"existing").unwrap();
        assert_eq!(
            resolve_output_path(&requested, ConflictResolution::AutoRename).unwrap(),
            dir.join("report (1).pdf")
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn no_clobber_commit_preserves_a_racing_destination() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();
        let temp = dir.join(".report.pdf.tmp");
        let destination = dir.join("report.pdf");
        fs::write(&temp, b"new").unwrap();
        fs::write(&destination, b"existing").unwrap();

        assert!(atomic_commit(&temp, &destination, false).is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"existing");
        assert_eq!(fs::read(&temp).unwrap(), b"new");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn write_preflight_leaves_no_probe_file_behind() {
        let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&dir).unwrap();

        ensure_directory_writable(&dir).unwrap();

        assert_eq!(fs::read_dir(&dir).unwrap().count(), 0);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn prepares_a_missing_absolute_output_directory() {
        let root = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&root).unwrap();
        let requested = root.join("exports").join("images");

        let prepared = prepare_output_directory(&requested).unwrap();

        assert_eq!(prepared, requested);
        #[cfg(windows)]
        assert!(!prepared.to_string_lossy().starts_with(r"\\?\"));
        assert!(prepared.is_absolute());
        assert!(prepared.is_dir());
        assert_eq!(fs::read_dir(&prepared).unwrap().count(), 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_a_relative_output_directory_without_creating_it() {
        let requested =
            std::path::PathBuf::from(format!("relative-output-{}", Uuid::new_v4()));

        let error = prepare_output_directory(&requested).unwrap_err();

        assert!(matches!(error, crate::error::AppError::InvalidInput(_)));
        assert!(!requested.exists());
    }

    #[test]
    fn rejects_an_existing_file_as_an_output_directory() {
        let root = std::env::temp_dir().join(Uuid::new_v4().to_string());
        fs::create_dir(&root).unwrap();
        let requested = root.join("not-a-directory");
        fs::write(&requested, b"file").unwrap();

        let error = prepare_output_directory(&requested).unwrap_err();

        assert!(matches!(
            error,
            crate::error::AppError::OutputNotWritable(_)
        ));
        fs::remove_dir_all(root).unwrap();
    }
}
