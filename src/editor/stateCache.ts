import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/** Per-tab editor state: edits, cursor, selection, and undo history all
 * survive tab switches. One EditorView exists; states are swapped in. */
const states = new Map<string, EditorState>();

export function cachedEditorState(path: string): EditorState | undefined {
  return states.get(path);
}

export function cacheEditorState(path: string, state: EditorState) {
  states.set(path, state);
}

export function dropEditorState(path: string) {
  states.delete(path);
}

export function clearEditorStates() {
  states.clear();
}

/** Rename support: move cached states under a renamed file or directory. */
export function remapEditorStates(from: string, to: string) {
  for (const [key, state] of [...states]) {
    if (key === from || key.startsWith(`${from}/`)) {
      states.delete(key);
      states.set(to + key.slice(from.length), state);
    }
  }
}

/** The one live view and which tab it currently shows, so the sync layer
 * can read the freshest doc and dispatch external reloads. */
let active: { path: string; view: EditorView } | null = null;

export function setActiveEditor(path: string | null, view: EditorView | null) {
  active = path !== null && view !== null ? { path, view } : null;
}

export function activeEditor(): { path: string; view: EditorView } | null {
  return active;
}
