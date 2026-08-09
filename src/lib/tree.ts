import type { DirEntry } from "../store/workspace.ts";

export interface TreeRow {
  entry: DirEntry;
  depth: number;
}

/** Flatten the loaded tree into its visible rows, in render order.
 * Drives both rendering and arrow-key navigation. */
export function visibleRows(
  root: string,
  entries: Record<string, DirEntry[]>,
  expanded: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (dir: string, depth: number) => {
    for (const entry of entries[dir] ?? []) {
      rows.push({ entry, depth });
      if (entry.isDir && expanded.has(entry.path)) walk(entry.path, depth + 1);
    }
  };
  walk(root, 0);
  return rows;
}

export function parentDir(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** True when `path` is `prefix` itself or nested anywhere below it. */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
