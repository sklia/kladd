import type { EditorState } from "@codemirror/state";

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
