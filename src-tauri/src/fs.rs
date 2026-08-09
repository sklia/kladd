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
