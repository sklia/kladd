use std::path::{Path, PathBuf};
use std::process::Command;

/// One changed path from `git status --porcelain`. `index` is the staged
/// column, `worktree` the unstaged one ('?' marks untracked). kladd has no
/// staging concept; the columns only feed display and the commit dialog's
/// default checkboxes.
#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    pub path: String,
    pub index: char,
    pub worktree: char,
}

fn run(root: &Path, args: &[&str]) -> Result<String, String> {
    run_prog(root, "git", args)
}

fn run_prog(root: &Path, program: &str, args: &[&str]) -> Result<String, String> {
    // Dev-mode diagnostics: spawn/exit failures print to the terminal
    // running `tauri dev`, since the UI swallows these by design.
    let output = match Command::new(program).args(args).current_dir(root).output() {
        Ok(output) => output,
        Err(e) => {
            eprintln!("kladd {program} {args:?}: spawn failed: {e}");
            return Err(format!("{program}: {e}"));
        }
    };
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        eprintln!("kladd {program} {args:?} failed: {stderr}");
        Err(stderr)
    }
}

/// Blocking git work off the async runtime thread pool.
async fn run_git<F>(f: F) -> Result<String, String>
where
    F: FnOnce() -> Result<String, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

/// Parse `git status --porcelain=v1 -z -b`. Returns (branch, changes).
/// With -z every record is NUL-terminated; rename/copy records carry a
/// second NUL-terminated field (the original path), which we skip.
pub fn parse_porcelain(output: &str) -> (Option<String>, Vec<GitChange>) {
    let mut tokens = output.split('\0').filter(|t| !t.is_empty());
    let mut branch = None;
    let mut changes = Vec::new();
    while let Some(token) = tokens.next() {
        if let Some(rest) = token.strip_prefix("## ") {
            let mut name = rest.split("...").next().unwrap_or(rest).trim();
            // Detached head: "## HEAD (no branch)".
            if let Some(base) = name.strip_suffix(" (no branch)") {
                name = base;
            }
            // Fresh repo: "## No commits yet on main".
            if let Some(base) = name.strip_prefix("No commits yet on ") {
                name = base;
            }
            branch = Some(name.to_string());
            continue;
        }
        let bytes = token.as_bytes();
        if bytes.len() < 4 {
            continue;
        }
        let index = bytes[0] as char;
        let worktree = bytes[1] as char;
        let path = &token[3..];
        if index == 'R' || index == 'C' || worktree == 'R' || worktree == 'C' {
            tokens.next(); // original path
        }
        changes.push(GitChange {
            path: path.to_string(),
            index,
            worktree,
        });
    }
    (branch, changes)
}

#[tauri::command]
pub async fn git_status(root: PathBuf) -> Result<(Option<String>, Vec<GitChange>), String> {
    run_git(move || run(&root, &["status", "--porcelain=v1", "-z", "-b"]))
        .await
        .map(|o| parse_porcelain(&o))
}

/// Commits exactly the given paths: included ones are staged (`add -A`),
/// excluded ones are pulled back out of the index, so the commit dialog's
/// checkbox list is the whole truth about what goes in. Paths are relative
/// to root.
#[tauri::command]
pub async fn git_commit(
    root: PathBuf,
    message: String,
    include: Vec<String>,
    exclude: Vec<String>,
) -> Result<(), String> {
    run_git(move || {
        for path in &exclude {
            run(&root, &["restore", "--staged", "--", path.as_str()])?;
        }
        if !include.is_empty() {
            let mut args = vec!["add", "-A", "--"];
            args.extend(include.iter().map(String::as_str));
            run(&root, &args)?;
        }
        run(&root, &["commit", "-m", message.as_str()])
    })
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn git_push(root: PathBuf) -> Result<(), String> {
    run_git(move || {
        let result = run(&root, &["push"]);
        // Fresh branch with no upstream yet: publish it same-named.
        if let Err(e) = &result {
            if e.contains("no upstream") {
                return run(&root, &["push", "-u", "origin", "HEAD"]).map(|_| String::new());
            }
        }
        result
    })
    .await
    .map(|_| ())
}

#[tauri::command]
pub async fn git_pull(root: PathBuf) -> Result<String, String> {
    run_git(move || run(&root, &["pull", "--ff-only"])).await
}

/// Clones into `<parent>/<repo name derived from url>`, returning the
/// absolute path of the clone so the frontend can open it.
#[tauri::command]
pub async fn git_clone(url: String, parent: PathBuf) -> Result<PathBuf, String> {
    let name = url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("")
        .trim_end_matches(".git");
    if name.is_empty() {
        return Err("cannot derive a folder name from that URL".into());
    }
    let dest = parent.join(name);
    if dest.exists() {
        return Err(format!("{} already exists", dest.display()));
    }
    let url_ = url;
    let parent_ = parent;
    let result = dest.clone();
    run_git(move || {
        let dest_str = dest.to_string_lossy().into_owned();
        run(&parent_, &["clone", url_.as_str(), dest_str.as_str()])
    })
    .await?;
    Ok(result)
}

#[tauri::command]
pub async fn git_init(root: PathBuf) -> Result<(), String> {
    eprintln!("kladd git_init invoked for {}", root.display());
    run_git(move || run(&root, &["init"])).await.map(|_| ())
}

#[tauri::command]
/// None when origin is missing or empty: normal for fresh and local-only
/// repos, never an error the frontend should see.
fn remote_url_or_none(root: &Path) -> Option<String> {
    let url = run(root, &["remote", "get-url", "origin"]).ok()?;
    let url = url.trim().to_string();
    if url.is_empty() { None } else { Some(url) }
}

#[tauri::command]
pub async fn git_remote_url(root: PathBuf) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(remote_url_or_none(&root)))
        .await
        .map_err(|e| e.to_string())?
}

/// First URL (github.com or otherwise) appearing in command output.
fn extract_url(output: &str) -> Option<String> {
    let start = output.find("https://")?;
    let end = output[start..]
        .find(char::is_whitespace)
        .map_or(output.len(), |i| start + i);
    Some(output[start..end].trim_end_matches('.').to_string())
}

/// Is the gh CLI present and logged in? kladd shells out to gh for repo
/// creation instead of implementing OAuth: it inherits the user's existing
/// auth and stores no tokens. Device flow is a roadmap item.
#[tauri::command]
pub async fn github_cli_ready() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(Command::new("gh")
            .args(["auth", "status"])
            .output()
            .is_ok_and(|o| o.status.success()))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Creates a GitHub repo under the authenticated user, wires it as origin,
/// and pushes the current branch. Requires the gh CLI. Works regardless of
/// whether origin already exists (e.g. its upstream was deleted): origin is
/// rewired to the fresh repo rather than created by gh.
#[tauri::command]
pub async fn github_create_repo(
    root: PathBuf,
    name: String,
    private: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("gh");
        cmd.args(["repo", "create", name.as_str()]);
        cmd.arg(if private { "--private" } else { "--public" });
        let output = cmd.current_dir(&root).output().map_err(|e| format!("gh: {e}"))?;
        let combined = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        if !output.status.success() {
            return Err(combined.trim().to_string());
        }
        let url = extract_url(&combined).ok_or_else(|| "created, but no URL in gh output".to_string())?;

        // Rewire origin: drop a stale one, ignore "no such remote".
        let _ = run_prog(&root, "git", &["remote", "remove", "origin"]);
        run_prog(&root, "git", &["remote", "add", "origin", &url])?;
        // -u publishes the branch under its own name and sets upstream,
        // replacing any stale tracking config from the old remote.
        run_prog(&root, "git", &["push", "-u", "origin", "HEAD"])?;
        Ok(url)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Opens a URL with the OS handler. Two lines of platform glue instead of
/// an opener plugin dependency.
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        let output = Command::new("cmd").args(["/C", "start", "", &url]).output();
        #[cfg(not(target_os = "windows"))]
        let output = Command::new("open").arg(&url).output();
        output
            .map(|_| ())
            .map_err(|e| format!("could not open {url}: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn porcelain_parses_branch_changes_and_renames() {
        let raw = "## main...origin/main [ahead 1]\0\
                   MM src/a.md\0\
                   ?? notes/new.md\0\
                   R  moved.md\0old.md\0\
                   D  gone.md\0";
        let (branch, changes) = parse_porcelain(raw);
        assert_eq!(branch.as_deref(), Some("main"));
        assert_eq!(
            changes,
            vec![
                GitChange { path: "src/a.md".into(), index: 'M', worktree: 'M' },
                GitChange { path: "notes/new.md".into(), index: '?', worktree: '?' },
                GitChange { path: "moved.md".into(), index: 'R', worktree: ' ' },
                GitChange { path: "gone.md".into(), index: 'D', worktree: ' ' },
            ]
        );
    }

    #[test]
    fn porcelain_handles_detached_and_empty_output() {
        assert_eq!(parse_porcelain("## HEAD (no branch)\0").0.as_deref(), Some("HEAD"));
        assert_eq!(parse_porcelain(""), (None, vec![]));
    }

    #[test]
    fn porcelain_reads_branch_before_first_commit() {
        assert_eq!(
            parse_porcelain("## No commits yet on main\0").0.as_deref(),
            Some("main")
        );
    }

    #[test]
    fn extract_url_finds_the_created_repo_url() {
        let out = "✓ Created repository erl/notest on GitHub\n\
                   ✓ Added remote https://github.com/erl/notest.git\n";
        assert_eq!(extract_url(out).as_deref(), Some("https://github.com/erl/notest.git"));
        assert_eq!(extract_url("no url here"), None);
    }

    /// The chain behind the Initialize Repository button, end to end:
    /// a fresh init must yield a status the frontend accepts as a repo.
    #[test]
    fn init_then_status_reports_a_clean_repo() {
        let dir = std::env::temp_dir().join(format!("kladd-git-init-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        run(&dir, &["init"]).unwrap();
        let out = run(&dir, &["status", "--porcelain=v1", "-z", "-b"]).unwrap();
        let (branch, changes) = parse_porcelain(&out);
        assert!(branch.is_some(), "status after init should carry a branch");
        assert!(changes.is_empty());
        // A repo without origin is normal; querying its remote must not
        // error the frontend (this bug made Initialize look like a no-op).
        let remote = remote_url_or_none(&dir);
        assert_eq!(remote, None);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
