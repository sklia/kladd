import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

interface UpdaterState {
  /** Version downloaded and installed, effective on next launch. */
  ready: string | null;
}

export const useUpdater = create<UpdaterState>()(() => ({ ready: null }));

/** Silent by design: check, download, install in the background. The
 * update applies on next launch; the only surface is a line in Settings.
 * Zero dialogs, per the vision. */
export async function checkForUpdates() {
  if (import.meta.env.DEV) return;
  try {
    const update = await check();
    if (update === null) return;
    await update.downloadAndInstall();
    useUpdater.setState({ ready: update.version });
  } catch {
    // Offline, or a local unsigned build: silently stay on this version.
  }
}

export function restartToUpdate() {
  void relaunch();
}
