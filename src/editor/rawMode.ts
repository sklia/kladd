import { Compartment, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/** Wraps every rendering extension, so ⌘E flips one tab between the live
 * preview and plain source. Per-tab for free: the mode lives in the
 * editor state, which the tab cache already preserves. */
export const renderMode = new Compartment();

export function toggleRawMode(view: EditorView, rendered: Extension): boolean {
  const current = renderMode.get(view.state);
  const isRaw = Array.isArray(current) && current.length === 0;
  view.dispatch({ effects: renderMode.reconfigure(isRaw ? rendered : []) });
  return true;
}
