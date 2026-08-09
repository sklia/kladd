import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import { useTabs } from "./tabs.ts";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

const RECENTS_KEY = "kladd.recentFolders";
const MAX_RECENTS = 8;

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface WorkspaceState {
  folder: string | null;
  folderName: string;
  recents: string[];
  /** Lazily loaded children, keyed by directory path. */
  entries: Record<string, DirEntry[]>;
  expanded: Set<string>;
  /** All files under folder, relative paths, for the quick switcher. */
  files: string[];
  openFolder: (path: string) => Promise<void>;
  pickFolder: () => Promise<void>;
  toggleDir: (path: string) => Promise<void>;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  folder: null,
  folderName: "",
  recents: loadRecents(),
  entries: {},
  expanded: new Set(),
  files: [],

  openFolder: async (path) => {
    useTabs.getState().closeAll();
    const recents = [path, ...get().recents.filter((r) => r !== path)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    set({
      folder: path,
      folderName: path.split("/").pop() ?? path,
      recents,
      entries: { [path]: await invoke<DirEntry[]>("read_dir", { path }) },
      expanded: new Set(),
      files: [],
    });
    // The full walk can be slow on huge folders; don't block the tree on it.
    const files = await invoke<string[]>("list_files", { root: path });
    if (get().folder === path) set({ files });
  },

  pickFolder: async () => {
    const path = await open({ directory: true });
    if (typeof path === "string") await get().openFolder(path);
  },

  toggleDir: async (path) => {
    const { expanded, entries } = get();
    const next = new Set(expanded);
    if (next.has(path)) {
      next.delete(path);
      set({ expanded: next });
      return;
    }
    next.add(path);
    if (entries[path] === undefined) {
      const children = await invoke<DirEntry[]>("read_dir", { path });
      set({ expanded: next, entries: { ...get().entries, [path]: children } });
    } else {
      set({ expanded: next });
    }
  },
}));
