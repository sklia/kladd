import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Annotation } from "@codemirror/state";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { activeEditor, cachedEditorState, cacheEditorState } from "../editor/stateCache.ts";
import { minimalDiff } from "../lib/minimalDiff.ts";
import { isUnder } from "../lib/tree.ts";
import { useSettings } from "./settings.ts";
import { initialDocFor, refreshInitialDoc, useTabs } from "./tabs.ts";
import { useWorkspace } from "./workspace.ts";

/** Marks transactions produced by external reloads, so the updateListener
 * doesn't schedule a save for content that just came from disk. */
export const syncAnnotation = Annotation.define<boolean>();

const pending = new Map<string, ReturnType<typeof setTimeout>>();

function currentDocFor(path: string): string | null {
  const active = activeEditor();
  if (active?.path === path) return active.view.state.doc.toString();
  const cached = cachedEditorState(path);
  if (cached !== undefined) return cached.doc.toString();
  if (useTabs.getState().tabs.some((t) => t.path === path)) return initialDocFor(path);
  return null;
}

function saveNow(path: string): Promise<void> {
  pending.delete(path);
  const contents = currentDocFor(path);
  if (contents === null) return Promise.resolve();
  return invoke<void>("write_file_atomic", { path, contents }).catch((e) => {
    // ponytail: log only; a save-error surface (status bar) comes with step 5
    console.error(`save failed for ${path}:`, e);
  });
}

export function scheduleSave(path: string) {
  clearTimeout(pending.get(path));
  pending.set(
    path,
    setTimeout(() => void saveNow(path), useSettings.getState().autosaveDelayMs),
  );
}

/** Save immediately if (and only if) a save is pending. The doc is read
 * synchronously, so callers may drop editor state right after this. */
export function flushSave(path: string): Promise<void> {
  const timer = pending.get(path);
  if (timer === undefined) return Promise.resolve();
  clearTimeout(timer);
  return saveNow(path);
}

export function flushAllSaves(): Promise<void> {
  return Promise.all([...pending.keys()].map(flushSave)).then(() => undefined);
}

/** Before a rename: settle pending writes so nothing writes to old paths. */
export function flushSavesUnder(prefix: string): Promise<void> {
  return Promise.all([...pending.keys()].filter((p) => isUnder(p, prefix)).map(flushSave)).then(
    () => undefined,
  );
}

/** Before a delete: pending saves must not resurrect the trashed file. */
export function cancelSavesUnder(prefix: string) {
  for (const [path, timer] of [...pending]) {
    if (isUnder(path, prefix)) {
      clearTimeout(timer);
      pending.delete(path);
    }
  }
}

async function reloadFromDisk(path: string) {
  let disk: string;
  try {
    disk = await invoke<string>("read_file", { path });
  } catch {
    return; // deleted or unreadable; tabs keep their buffer
  }
  const current = currentDocFor(path);
  if (current === null || current === disk) return; // not open, or our own save echoing
  if (pending.has(path)) return; // buffer has newer edits: last writer wins

  const span = minimalDiff(current, disk);
  if (span === null) return;
  const active = activeEditor();
  if (active?.path === path) {
    active.view.dispatch({ changes: span, annotations: syncAnnotation.of(true) });
  } else {
    const cached = cachedEditorState(path);
    if (cached !== undefined) {
      cacheEditorState(
        path,
        cached.update({ changes: span, annotations: syncAnnotation.of(true) }).state,
      );
    }
  }
  refreshInitialDoc(path, disk);
}

async function onFsChanged(paths: string[]) {
  const open = new Set(useTabs.getState().tabs.map((t) => t.path));
  await Promise.all(paths.filter((p) => open.has(p)).map(reloadFromDisk));
  await useWorkspace.getState().refreshChanged(paths);
}

/** Called once from App. Returns a cleanup for StrictMode double-mounts. */
export function initSync(): () => void {
  const unlistenFs = listen<string[]>("fs-changed", (event) => void onFsChanged(event.payload));

  let closing = false;
  const window = getCurrentWindow();
  const unlistenClose = window.onCloseRequested(async (event) => {
    if (closing) return;
    closing = true;
    event.preventDefault();
    await flushAllSaves();
    await window.destroy();
  });

  // Cmd+Q bypasses window close: Rust holds the exit and emits this instead.
  const unlistenQuit = listen("quit-requested", () => {
    void flushAllSaves().finally(() => void invoke("confirm_quit"));
  });

  return () => {
    void unlistenFs.then((f) => f());
    void unlistenClose.then((f) => f());
    void unlistenQuit.then((f) => f());
  };
}
