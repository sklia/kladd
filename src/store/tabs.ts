import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { clearEditorStates, dropEditorState, remapEditorStates } from "../editor/stateCache.ts";
import { isUnder } from "../lib/tree.ts";
import { flushAllSaves, flushSave } from "./sync.ts";

export interface Tab {
  /** Absolute path; unique tab id. */
  path: string;
  name: string;
}

/** Initial doc text per open tab. Live edits stay inside the CodeMirror
 * state cache (src/editor/Editor.tsx); this is only what the file held
 * when the tab was opened. */
const initialDocs = new Map<string, string>();

export function initialDocFor(path: string): string {
  return initialDocs.get(path) ?? "";
}

/** Keep the initial doc in step with disk after an external reload. */
export function refreshInitialDoc(path: string, text: string) {
  if (initialDocs.has(path)) initialDocs.set(path, text);
}

interface TabsState {
  tabs: Tab[];
  active: string | null;
  openTab: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  closeAll: () => void;
  /** After a rename: carry tabs, editor states, and docs to the new path.
   * Prefix-aware, so renaming a directory moves everything under it. */
  remapPath: (from: string, to: string) => void;
  /** Close tabs under a deleted path without flushing saves. */
  closeUnder: (prefix: string) => void;
}

export const useTabs = create<TabsState>()((set, get) => ({
  tabs: [],
  active: null,

  openTab: async (path) => {
    if (!get().tabs.some((t) => t.path === path)) {
      initialDocs.set(path, await invoke<string>("read_file", { path }));
      const name = path.split("/").pop() ?? path;
      set({ tabs: [...get().tabs, { path, name }] });
    }
    set({ active: path });
  },

  closeTab: (path) => {
    void flushSave(path); // reads the doc synchronously, safe to drop state after
    const tabs = get().tabs.filter((t) => t.path !== path);
    initialDocs.delete(path);
    dropEditorState(path);
    let { active } = get();
    if (active === path) active = tabs.at(-1)?.path ?? null;
    set({ tabs, active });
  },

  setActive: (path) => set({ active: path }),

  closeAll: () => {
    void flushAllSaves(); // doc capture is synchronous, before the clears below
    initialDocs.clear();
    clearEditorStates();
    set({ tabs: [], active: null });
  },

  remapPath: (from, to) => {
    const move = (path: string) => to + path.slice(from.length);
    for (const [key, doc] of [...initialDocs]) {
      if (isUnder(key, from)) {
        initialDocs.delete(key);
        initialDocs.set(move(key), doc);
      }
    }
    remapEditorStates(from, to);
    const tabs = get().tabs.map((t) =>
      isUnder(t.path, from)
        ? { path: move(t.path), name: move(t.path).split("/").pop() ?? t.name }
        : t,
    );
    const { active } = get();
    set({ tabs, active: active !== null && isUnder(active, from) ? move(active) : active });
  },

  closeUnder: (prefix) => {
    const closing = get().tabs.filter((t) => isUnder(t.path, prefix));
    for (const tab of closing) {
      initialDocs.delete(tab.path);
      dropEditorState(tab.path);
    }
    const tabs = get().tabs.filter((t) => !isUnder(t.path, prefix));
    let { active } = get();
    if (active !== null && isUnder(active, prefix)) active = tabs.at(-1)?.path ?? null;
    set({ tabs, active });
  },
}));
