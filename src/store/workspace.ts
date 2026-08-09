import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import { parentDir } from "../lib/tree.ts";
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

export interface TreeEditing {
  kind: "rename" | "new-file" | "new-dir";
  /** Path being renamed, or the directory receiving the new entry. */
  target: string;
  error?: string;
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
  /** Tree row selection (keyboard nav + file op target). */
  selected: string | null;
  setSelected: (path: string | null) => void;
  /** Active inline edit row in the tree, if any. */
  editing: TreeEditing | null;
  setEditing: (editing: TreeEditing | null) => void;
  /** Begin an inline edit: rename the selection, or create inside it
   * (a selected file targets its parent directory; nothing targets root). */
  startEdit: (kind: TreeEditing["kind"]) => Promise<void>;
  openFolder: (path: string) => Promise<void>;
  pickFolder: () => Promise<void>;
  toggleDir: (path: string) => Promise<void>;
  /** Re-read tree entries and the switcher file list after fs changes. */
  refreshChanged: (paths: string[]) => Promise<void>;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  folder: null,
  folderName: "",
  recents: loadRecents(),
  entries: {},
  expanded: new Set(),
  files: [],
  selected: null,
  setSelected: (selected) => set({ selected }),
  editing: null,
  setEditing: (editing) => set({ editing }),

  startEdit: async (kind) => {
    const { folder, selected } = get();
    if (folder === null) return;
    if (kind === "rename") {
      if (selected !== null) set({ editing: { kind, target: selected } });
      return;
    }
    let dir = folder;
    if (selected !== null) {
      const entry = get().entries[parentDir(selected)]?.find((e) => e.path === selected);
      dir = entry?.isDir === true ? selected : parentDir(selected);
    }
    if (dir !== folder && !get().expanded.has(dir)) await get().toggleDir(dir);
    set({ editing: { kind, target: dir } });
  },

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
      selected: null,
      editing: null,
    });
    void invoke("watch_workspace", { root: path });
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

  refreshChanged: async (paths) => {
    const { folder, entries } = get();
    if (folder === null) return;
    const parents = new Set(paths.map((p) => p.slice(0, p.lastIndexOf("/"))));
    const reloaded = await Promise.all(
      Object.keys(entries)
        .filter((dir) => parents.has(dir))
        .map(async (dir) => {
          try {
            return [dir, await invoke<DirEntry[]>("read_dir", { path: dir })] as const;
          } catch {
            return null; // directory itself was removed
          }
        }),
    );
    const files = await invoke<string[]>("list_files", { root: folder });
    if (get().folder !== folder) return; // workspace switched mid-refresh
    set({
      entries: { ...get().entries, ...Object.fromEntries(reloaded.filter((r) => r !== null)) },
      files,
    });
  },
}));
