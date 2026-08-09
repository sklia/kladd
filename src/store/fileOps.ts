import { invoke } from "@tauri-apps/api/core";
import { parentDir } from "../lib/tree.ts";
import { cancelSavesUnder, flushSavesUnder } from "./sync.ts";
import { useTabs } from "./tabs.ts";
import { useWorkspace } from "./workspace.ts";

/** File operations orchestrate the Rust command plus every in-memory
 * structure that references paths: tabs, editor states, pending saves,
 * tree. Each returns an error message for the inline edit row, or null. */

export async function createEntry(
  kind: "new-file" | "new-dir",
  dir: string,
  name: string,
): Promise<string | null> {
  const path = `${dir}/${name}`;
  try {
    await invoke(kind === "new-file" ? "create_file" : "create_dir", { path });
  } catch (e) {
    return String(e);
  }
  await useWorkspace.getState().refreshChanged([path]);
  useWorkspace.getState().setSelected(path);
  if (kind === "new-file") await useTabs.getState().openTab(path);
  return null;
}

export async function renameEntry(from: string, newName: string): Promise<string | null> {
  const to = `${parentDir(from)}/${newName}`;
  await flushSavesUnder(from); // settle writes before paths move
  try {
    await invoke("rename_path", { from, to });
  } catch (e) {
    return String(e);
  }
  useTabs.getState().remapPath(from, to);
  useWorkspace.getState().setSelected(to);
  await useWorkspace.getState().refreshChanged([from, to]);
  return null;
}

export async function deleteEntry(path: string): Promise<string | null> {
  cancelSavesUnder(path); // a pending save must not resurrect the file
  useTabs.getState().closeUnder(path);
  try {
    await invoke("delete_path", { path });
  } catch (e) {
    return String(e);
  }
  useWorkspace.getState().setSelected(null);
  await useWorkspace.getState().refreshChanged([path]);
  return null;
}
