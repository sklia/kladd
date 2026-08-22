use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
    pub title: Option<String>,
}

fn is_markdown(name: &str) -> bool {
    name.to_lowercase().ends_with(".md")
}

/// Display title from the first KB of a markdown file: frontmatter
/// `title:`, else the first `# ` heading. A title cut by the 1 KB cap is
/// accepted as-is (ponytail: nobody's title needs a kilobyte).
fn extract_title(path: &Path) -> Option<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).ok()?;
    let mut buf = [0u8; 1024];
    let n = file.read(&mut buf).ok()?;
    let text = String::from_utf8_lossy(&buf[..n]);
    let mut lines = text.lines().peekable();
    if lines.peek().map(|l| l.trim_end()) == Some("---") {
        lines.next();
        for line in lines.by_ref() {
            let line = line.trim_end();
            if line == "---" {
                break;
            }
            if let Some(rest) = line.strip_prefix("title:") {
                let title = rest.trim().trim_matches('"').trim_matches('\'').trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
    }
    lines
        .find_map(|l| l.strip_prefix("# "))
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty())
}

/// A directory earns its place in the tree only if markdown lives somewhere
/// under it (any depth), or it is completely empty (so a newly created folder
/// stays visible until filled). Name-agnostic: an image-only paste target like
/// assets/ stays out of the way, while a notes folder that happens to be named
/// assets keeps its place. Unreadable directories are shown rather than
/// silently hidden. ponytail: each listing walks subdirectories to prove they
/// hold markdown; fine at personal-notes scale, revisit for huge trees.
fn keep_dir(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return true;
    };
    let mut any = false;
    for entry in entries.flatten() {
        // Dotfiles (.DS_Store and friends) don't count as content: a folder
        // that "looks" empty must behave as empty.
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        any = true;
        match entry.file_type() {
            // Symlinks are neither file nor dir here (file_type doesn't
            // follow), which also keeps symlink cycles out of the walk.
            Ok(t) if t.is_dir() => {
                if keep_dir(&entry.path()) {
                    return true;
                }
            }
            Ok(t) if t.is_file() => {
                if is_markdown(&entry.file_name().to_string_lossy()) {
                    return true;
                }
            }
            _ => {}
        }
    }
    !any
}

/// Shallow listing for the file tree; the frontend expands lazily.
/// Only directories and markdown files: kladd shows nothing else.
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
            if is_dir && !keep_dir(&e.path()) {
                return None;
            }
            if !is_dir && !is_markdown(&name) {
                return None;
            }
            let title = if is_dir { None } else { extract_title(&e.path()) };
            Some(DirEntry {
                name,
                path: e.path(),
                is_dir,
                title,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHit {
    pub rel: String,
    pub title: Option<String>,
}

/// Every non-hidden, non-gitignored markdown file under root, as relative
/// paths with display titles. Feeds the quick switcher and the title map.
#[tauri::command]
pub fn list_files(root: PathBuf) -> Result<Vec<FileHit>, String> {
    // ponytail: hard cap instead of streaming; revisit if a real folder hits it
    const MAX_FILES: usize = 50_000;
    let mut files = Vec::new();
    for entry in ignore::WalkBuilder::new(&root).build().flatten() {
        if entry.file_type().is_some_and(|t| t.is_file())
            && is_markdown(&entry.file_name().to_string_lossy())
        {
            if let Ok(rel) = entry.path().strip_prefix(&root) {
                files.push(FileHit {
                    rel: rel.to_string_lossy().into_owned(),
                    title: extract_title(entry.path()),
                });
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

/// For pasted images: creates the parent dir (the assets folder) on demand.
/// No atomic-temp-file dance here, unlike `write_file_atomic` — this is an
/// occasional paste, not the autosave hot path, and the filename is unique
/// per paste so there's nothing to race with.
#[tauri::command]
pub fn write_binary_file(path: PathBuf, data: Vec<u8>) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

/// Fails if the file already exists: creating over content is a data-loss
/// path, and the frontend validates names before calling.
/// New notes start with "# " so the first thing typed is the heading.
#[tauri::command]
pub fn create_file(path: PathBuf) -> Result<(), String> {
    if path.exists() {
        return Err("already exists".into());
    }
    std::fs::write(&path, "# ").map_err(|e| e.to_string())
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
    fn title_from_frontmatter_then_heading_then_none() {
        let dir = std::env::temp_dir().join(format!("kladd-title-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let case = |content: &str| {
            let p = dir.join("t.md");
            std::fs::write(&p, content).unwrap();
            extract_title(&p)
        };
        assert_eq!(
            case("---\ntitle: Implementation plan\n---\n# Other\n"),
            Some("Implementation plan".into())
        );
        assert_eq!(case("---\ndate: 2026\n---\n\n# From Heading\n"), Some("From Heading".into()));
        assert_eq!(case("# Just a Heading\nbody\n"), Some("Just a Heading".into()));
        assert_eq!(case("no heading here\n"), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn tree_hides_image_only_dirs_keeps_empty_and_markdown_ones() {
        use std::fs;
        let dir = std::env::temp_dir().join(format!("kladd-tree-{}", std::process::id()));
        let assets = dir.join("assets");
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("paste.png"), [1, 2, 3]).unwrap();
        let empty = dir.join("new-folder");
        fs::create_dir_all(&empty).unwrap();
        let named_assets = dir.join("notes-assets");
        fs::create_dir_all(named_assets.join("deep")).unwrap();
        fs::write(named_assets.join("deep").join("note.md"), "# hi").unwrap();
        let emptied = dir.join("emptied");
        fs::create_dir_all(&emptied).unwrap();
        fs::write(emptied.join(".DS_Store"), [1]).unwrap();

        assert!(!keep_dir(&assets), "image-only dir should be hidden");
        assert!(keep_dir(&empty), "empty dir stays visible for creation");
        assert!(keep_dir(&named_assets), "markdown at any depth keeps a dir");
        assert!(
            keep_dir(&emptied),
            "dotfiles don't count as content: an emptied folder is empty"
        );

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn binary_write_creates_parent_dir_and_writes_bytes() {
        let dir = std::env::temp_dir().join(format!("kladd-binary-{}", std::process::id()));
        let target = dir.join("assets").join("paste.png");

        write_binary_file(target.clone(), vec![1, 2, 3]).unwrap();

        assert_eq!(std::fs::read(&target).unwrap(), vec![1, 2, 3]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

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
