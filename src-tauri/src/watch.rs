use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

type Debouncer = notify_debouncer_full::Debouncer<
    notify::RecommendedWatcher,
    notify_debouncer_full::RecommendedCache,
>;

#[derive(Default)]
pub struct WatcherState(Mutex<Option<Debouncer>>);

/// Any dot-prefixed path component: .git churn, our own .*.kladd-tmp files,
/// editor swap files. Mirrors read_dir's hidden-file rule.
fn is_hidden(path: &Path) -> bool {
    path.components().any(|c| match c {
        Component::Normal(name) => name.to_string_lossy().starts_with('.'),
        _ => false,
    })
}

/// Watch a workspace root recursively, replacing any previous watcher.
/// Emits debounced `fs-changed` events with the affected absolute paths.
#[tauri::command]
pub fn watch_workspace(
    app: AppHandle,
    state: State<'_, WatcherState>,
    root: PathBuf,
) -> Result<(), String> {
    let mut debouncer = new_debouncer(
        Duration::from_millis(400),
        None,
        move |result: DebounceEventResult| {
            let Ok(events) = result else { return };
            let mut paths: Vec<String> = events
                .iter()
                .flat_map(|event| event.paths.iter())
                .filter(|path| !is_hidden(path))
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            paths.sort();
            paths.dedup();
            if !paths.is_empty() {
                let _ = app.emit("fs-changed", paths);
            }
        },
    )
    .map_err(|e| e.to_string())?;
    debouncer
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    // Dropping the previous debouncer stops its watcher.
    *state.0.lock().unwrap() = Some(debouncer);
    Ok(())
}
