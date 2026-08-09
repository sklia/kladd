import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { clearEditorStates, dropEditorState } from "../editor/stateCache.ts";
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
}));
