import { Fragment, useRef, useState } from "react";
import { ensureMd, stripExt, validateName } from "../lib/names.ts";
import { parentDir, type TreeRow, visibleRows } from "../lib/tree.ts";
import { createEntry, deleteEntry, renameEntry } from "../store/fileOps.ts";
import { useTabs } from "../store/tabs.ts";
import { type DirEntry, useWorkspace } from "../store/workspace.ts";
import { Menu, type MenuEntry } from "./Menu.tsx";
import { TreeEditRow } from "./TreeEditRow.tsx";
import { useTreeDrag } from "./useTreeDrag.ts";

interface ContextMenuState {
  at: { x: number; y: number };
  entry: DirEntry | null; // null: workspace root background
}

function menuEntries(target: DirEntry | null): MenuEntry[] {
  const create: MenuEntry[] = [
    { id: "new-file", label: "New File", hint: "⌘N" },
    { id: "new-dir", label: "New Folder" },
  ];
  if (target === null) return create;
  return [
    ...create,
    "separator",
    { id: "rename", label: "Rename" },
    {
      id: "delete",
      label: target.isDir ? "Move Folder to Trash" : "Move to Trash",
      hint: "⌘⌫",
      danger: true,
    },
  ];
}

export function FileTree() {
  const folder = useWorkspace((s) => s.folder);
  const entries = useWorkspace((s) => s.entries);
  const expanded = useWorkspace((s) => s.expanded);
  const selected = useWorkspace((s) => s.selected);
  const setSelected = useWorkspace((s) => s.setSelected);
  const editing = useWorkspace((s) => s.editing);
  const setEditing = useWorkspace((s) => s.setEditing);
  const startEdit = useWorkspace((s) => s.startEdit);
  const toggleDir = useWorkspace((s) => s.toggleDir);
  const openTab = useTabs((s) => s.openTab);
  const activeTab = useTabs((s) => s.active);
  const host = useRef<HTMLElement>(null);
  const [context, setContext] = useState<ContextMenuState | null>(null);
  const { drag, onRowPointerDown, consumeDrop } = useTreeDrag(folder ?? "");

  if (folder === null) return null;
  const rows = visibleRows(folder, entries, expanded);

  const commitEdit = async (raw: string) => {
    if (editing === null) return;
    const dir = editing.kind === "rename" ? parentDir(editing.target) : editing.target;
    const ownName = editing.kind === "rename" ? (editing.target.split("/").pop() ?? "") : null;
    // Typing ".md" is never required; files get it appended.
    const isFile =
      editing.kind === "new-file" ||
      (editing.kind === "rename" &&
        entries[dir]?.find((e) => e.path === editing.target)?.isDir !== true);
    const name = isFile ? ensureMd(raw.trim()) : raw.trim();
    const siblings = (entries[dir] ?? []).map((e) => e.name).filter((n) => n !== ownName);
    const invalid = validateName(name, siblings);
    if (invalid !== null) {
      setEditing({ ...editing, error: invalid });
      return;
    }
    const failed =
      editing.kind === "rename"
        ? await renameEntry(editing.target, name)
        : await createEntry(editing.kind, dir, name);
    if (failed !== null) setEditing({ ...editing, error: failed });
    else {
      setEditing(null);
      host.current?.focus();
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    host.current?.focus();
  };

  const activate = (entry: DirEntry) => {
    if (consumeDrop()) return; // the click that ends a drag is not a click
    setSelected(entry.path);
    if (entry.isDir) void toggleDir(entry.path);
    else void openTab(entry.path);
  };

  const openContextAt = (entry: DirEntry | null, at: { x: number; y: number }) => {
    if (entry !== null) setSelected(entry.path);
    setContext({ at, entry });
  };

  const onMenuSelect = (id: string) => {
    const target = context?.entry ?? null;
    if (id === "rename" && target !== null) void startEdit("rename");
    else if (id === "delete" && target !== null) void deleteEntry(target.path);
    else if (id === "new-file" || id === "new-dir") {
      // Create where the user clicked: background → root, folder → inside
      // it, file → beside it.
      const dir = target === null ? folder : target.isDir ? target.path : parentDir(target.path);
      void startEdit(id, dir);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing !== null) return;
    const index = rows.findIndex((r) => r.entry.path === selected);
    const row: TreeRow | undefined = rows[index];
    const select = (i: number) => {
      const next = rows[Math.max(0, Math.min(i, rows.length - 1))];
      if (next !== undefined) setSelected(next.entry.path);
    };
    if (e.key === "ArrowDown") select(index + 1);
    else if (e.key === "ArrowUp") select(index < 0 ? 0 : index - 1);
    else if (e.key === "ArrowRight" && row?.entry.isDir === true) {
      if (expanded.has(row.entry.path)) select(index + 1);
      else void toggleDir(row.entry.path);
    } else if (e.key === "ArrowLeft" && row !== undefined) {
      if (row.entry.isDir && expanded.has(row.entry.path)) void toggleDir(row.entry.path);
      else {
        const parent = parentDir(row.entry.path);
        if (parent !== folder) setSelected(parent);
      }
    } else if (e.key === "Enter" && row !== undefined) activate(row.entry);
    else if (e.key === "Backspace" && e.metaKey && row !== undefined) {
      void deleteEntry(row.entry.path);
    } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      const el = host.current?.querySelector(`[data-path="${CSS.escape(selected ?? "")}"]`);
      const rect = el?.getBoundingClientRect();
      if (row !== undefined && rect !== undefined) {
        openContextAt(row.entry, { x: rect.left + 24, y: rect.bottom });
      }
    } else return;
    e.preventDefault();
  };

  // The edit row for creates renders right below its target directory's row
  // (or at the top for the workspace root).
  const editRowFor = (afterPath: string | null, depth: number) => {
    if (editing === null || editing.kind === "rename") return null;
    const anchor = editing.target === folder ? null : editing.target;
    if (anchor !== afterPath) return null;
    return (
      <TreeEditRow
        initial="untitled"
        depth={depth}
        error={editing.error}
        onCommit={(raw) => void commitEdit(raw)}
        onCancel={cancelEdit}
      />
    );
  };

  return (
    <nav
      ref={host}
      className={`filetree${drag?.over === folder ? " drop-root" : ""}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextAt(null, { x: e.clientX, y: e.clientY });
      }}
    >
      {editRowFor(null, 0)}
      {rows.map(({ entry, depth }) => (
        <Fragment key={entry.path}>
          {editing?.kind === "rename" && editing.target === entry.path ? (
            <TreeEditRow
              initial={entry.isDir ? entry.name : stripExt(entry.name)}
              depth={depth}
              error={editing.error}
              onCommit={(raw) => void commitEdit(raw)}
              onCancel={cancelEdit}
            />
          ) : (
            <button
              type="button"
              data-path={entry.path}
              className={`tree-row${entry.isDir ? " tree-dir" : ""}${
                selected === entry.path ? " selected" : ""
              }${activeTab === entry.path ? " active" : ""}${
                drag?.entry.path === entry.path ? " dragging" : ""
              }${drag?.over === entry.path ? " drop-target" : ""}`}
              style={{ paddingLeft: `${depth * 0.85 + 0.5}rem` }}
              tabIndex={-1}
              onPointerDown={onRowPointerDown(entry)}
              onClick={() => activate(entry)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openContextAt(entry, { x: e.clientX, y: e.clientY });
              }}
            >
              {entry.isDir && (
                <svg
                  className={`tree-twist${expanded.has(entry.path) ? " open" : ""}`}
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                >
                  <path d="M3.5 2 L7 5 L3.5 8" fill="none" strokeWidth="1.5" />
                </svg>
              )}
              {entry.isDir ? entry.name : (entry.title ?? stripExt(entry.name))}
            </button>
          )}
          {entry.isDir && editRowFor(entry.path, depth + 1)}
        </Fragment>
      ))}
      {drag !== null && (
        <div className="tree-ghost" style={{ left: drag.x + 10, top: drag.y + 6 }}>
          {drag.entry.isDir ? drag.entry.name : (drag.entry.title ?? stripExt(drag.entry.name))}
        </div>
      )}
      {context !== null && (
        <Menu
          entries={menuEntries(context.entry)}
          anchor={context.at}
          onClose={() => {
            setContext(null);
            host.current?.focus();
          }}
          onSelect={onMenuSelect}
        />
      )}
    </nav>
  );
}
