import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { toastError, toastInfo } from "./toasts.ts";
import { useWorkspace } from "./workspace.ts";

export interface GitChange {
  path: string;
  index: string;
  worktree: string;
}

interface GitState {
  repo: boolean;
  branch: string | null;
  changes: GitChange[];
  remoteUrl: string | null;
  /** A commit/push/pull is running; buttons disable and show it. */
  busy: boolean;
  /** Human-readable in-progress label for the chip, e.g. "Pushing". */
  busyLabel: string | null;
  error: string | null;
  dialogOpen: boolean;
  cloneOpen: boolean;
  publishOpen: boolean;
  refresh: () => Promise<void>;
  setDialogOpen: (open: boolean) => void;
  setCloneOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  commit: (message: string, include: string[], andPush: boolean) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  /** Creates the GitHub repo via the gh CLI and pushes. */
  publish: (name: string, isPrivate: boolean) => Promise<boolean>;
}

/** Trailing debounce: fs-changed fires per autosave, status needn't. */
let timer: ReturnType<typeof setTimeout> | undefined;

export const useGit = create<GitState>()((set, get) => ({
  repo: false,
  branch: null,
  changes: [],
  remoteUrl: null,
  busy: false,
  busyLabel: null,
  error: null,
  dialogOpen: false,
  cloneOpen: false,
  publishOpen: false,

  refresh: async () => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(async () => {
        const folder = useWorkspace.getState().folder;
        if (folder === null) {
          set({ repo: false, branch: null, changes: [], remoteUrl: null });
          resolve();
          return;
        }
        try {
          const [branch, changes] = await invoke<[string | null, GitChange[]]>("git_status", {
            root: folder,
          });
          if (useWorkspace.getState().folder !== folder) return; // switched mid-flight
          let remoteUrl: string | null = null;
          // Only re-resolve the remote when we don't know it yet or the
          // repo identity may have changed (e.g. after git init).
          if (!get().repo || get().remoteUrl === null) {
            try {
              remoteUrl = await invoke<string | null>("git_remote_url", { root: folder });
            } catch {
              remoteUrl = null; // no origin is normal, never fatal
            }
          } else {
            remoteUrl = get().remoteUrl;
          }
          if (useWorkspace.getState().folder !== folder) return;
          set({ repo: true, branch, changes, remoteUrl, error: null });
        } catch {
          // Not a git repository (or git missing): affordances stay off.
          set({ repo: false, branch: null, changes: [], remoteUrl: null });
        }
        resolve();
      }, 250);
    });
  },

  setDialogOpen: (dialogOpen) => set({ dialogOpen, error: null }),
  setCloneOpen: (cloneOpen) => set({ cloneOpen }),
  setPublishOpen: (publishOpen) => set({ publishOpen, error: null }),

  commit: async (message, include, andPush) => {
    const folder = useWorkspace.getState().folder;
    if (folder === null || get().busy) return;
    const exclude = get()
      .changes.map((c) => c.path)
      .filter((p) => !include.includes(p));
    set({ busy: true, busyLabel: andPush ? "Committing & pushing" : "Committing", error: null });
    try {
      await invoke("git_commit", { root: folder, message, include, exclude });
      if (andPush) await invoke("git_push", { root: folder });
      set({ dialogOpen: false, busy: false, busyLabel: null });
      toastInfo(andPush ? "Committed & pushed" : "Committed");
      await get().refresh();
    } catch (e) {
      set({ busy: false, busyLabel: null, error: String(e) });
      toastError(String(e));
    }
  },

  push: async () => {
    const folder = useWorkspace.getState().folder;
    if (folder === null || get().busy) return;
    set({ busy: true, busyLabel: "Pushing", error: null });
    try {
      await invoke("git_push", { root: folder });
      set({ busy: false, busyLabel: null });
      toastInfo("Pushed");
      await get().refresh();
    } catch (e) {
      const error = String(e);
      // Upstream deleted (repo gone on the host): forget the remote so
      // "Publish to GitHub…" reappears and a new repo can be created.
      const updates: Partial<GitState> = { busy: false, busyLabel: null, error };
      if (/not found|404|does not exist|has been removed/i.test(error)) {
        updates.remoteUrl = null;
      }
      set(updates);
      toastError(error);
    }
  },

  pull: async () => {
    const folder = useWorkspace.getState().folder;
    if (folder === null || get().busy) return;
    set({ busy: true, busyLabel: "Pulling", error: null });
    try {
      await invoke("git_pull", { root: folder });
      set({ busy: false, busyLabel: null });
      toastInfo("Pulled");
      await get().refresh();
    } catch (e) {
      set({ busy: false, busyLabel: null, error: String(e) });
      toastError(String(e));
    }
  },

  publish: async (name, isPrivate) => {
    const folder = useWorkspace.getState().folder;
    if (folder === null || get().busy) return false;
    set({ busy: true, busyLabel: "Publishing", error: null });
    try {
      const url = await invoke<string>("github_create_repo", {
        root: folder,
        name,
        private: isPrivate,
      });
      set({ busy: false, busyLabel: null, remoteUrl: url });
      toastInfo(`Published to ${url}`);
      await get().refresh();
      return true;
    } catch (e) {
      set({ busy: false, busyLabel: null, error: String(e) });
      toastError(String(e));
      return false;
    }
  },
}));
