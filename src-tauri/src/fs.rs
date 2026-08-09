use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
}

/// Shallow listing for the file tree; the frontend expands lazily.
/// Hidden entries are skipped: dotfiles are noise in a writing tool.
#[tauri::command]
pub fn read_dir(path: PathBuf) -> Result<Vec<DirEntry>, String> {
    let mut entries: Vec<DirEntry> = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                return None;
            }
            let is_dir = e.file_type().ok()?.is_dir();
            Some(DirEntry {
                name,
                path: e.path(),
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

/// Every non-hidden, non-gitignored file under root, as relative paths.
/// Feeds the quick switcher.
#[tauri::command]
pub fn list_files(root: PathBuf) -> Result<Vec<String>, String> {
    // ponytail: hard cap instead of streaming; revisit if a real folder hits it
    const MAX_FILES: usize = 50_000;
    let mut files = Vec::new();
    for entry in ignore::WalkBuilder::new(&root).build().flatten() {
        if entry.file_type().is_some_and(|t| t.is_file()) {
            if let Ok(rel) = entry.path().strip_prefix(&root) {
                files.push(rel.to_string_lossy().into_owned());
                if files.len() >= MAX_FILES {
                    break;
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
pub fn read_file(path: PathBuf) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write via a dot-prefixed temp file in the same directory, then rename.
/// Same filesystem, so the rename is atomic: readers (and agents) never see
/// a half-written file. The dot prefix keeps it out of the watcher too.
#[tauri::command]
pub fn write_file_atomic(path: PathBuf, contents: String) -> Result<(), String> {
    let dir = path.parent().ok_or("path has no parent directory")?;
    let name = path.file_name().ok_or("path has no file name")?.to_string_lossy();
    let tmp = dir.join(format!(".{name}.kladd-tmp"));
    let write = || -> std::io::Result<()> {
        use std::io::Write;
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        std::fs::rename(&tmp, &path)
    };
    write().map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Fails if the file already exists: creating over content is a data-loss
/// path, and the frontend validates names before calling.
#[tauri::command]
pub fn create_file(path: PathBuf) -> Result<(), String> {
    if path.exists() {
        return Err("already exists".into());
    }
    std::fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_dir(path: PathBuf) -> Result<(), String> {
    if path.exists() {
        return Err("already exists".into());
    }
    std::fs::create_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(from: PathBuf, to: PathBuf) -> Result<(), String> {
    if to.exists() {
        return Err("already exists".into());
    }
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// To the OS trash, never permanent: the only delete that needs no
/// confirmation dialog.
#[tauri::command]
pub fn delete_path(path: PathBuf) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_content_and_leaves_no_temp() {
        let dir = std::env::temp_dir().join(format!("kladd-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("doc.md");
        std::fs::write(&target, "old").unwrap();

        write_file_atomic(target.clone(), "new content".into()).unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "new content");
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("kladd-tmp"))
            .collect();
        assert!(leftovers.is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
