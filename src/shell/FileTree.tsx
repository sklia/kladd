import { Fragment, useRef, useState } from "react";
import { validateName } from "../lib/names.ts";
import { parentDir, type TreeRow, visibleRows } from "../lib/tree.ts";
import { createEntry, deleteEntry, renameEntry } from "../store/fileOps.ts";
import { useTabs } from "../store/tabs.ts";
import { type DirEntry, useWorkspace } from "../store/workspace.ts";
import { Menu, type MenuEntry } from "./Menu.tsx";
import { TreeEditRow } from "./TreeEditRow.tsx";

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

  if (folder === null) return null;
  const rows = visibleRows(folder, entries, expanded);

  const commitEdit = async (raw: string) => {
    if (editing === null) return;
    const dir = editing.kind === "rename" ? parentDir(editing.target) : editing.target;
    const ownName = editing.kind === "rename" ? (editing.target.split("/").pop() ?? "") : null;
    const siblings = (entries[dir] ?? []).map((e) => e.name).filter((n) => n !== ownName);
    const invalid = validateName(raw, siblings);
    if (invalid !== null) {
      setEditing({ ...editing, error: invalid });
      return;
    }
    const name = raw.trim();
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
    else if (id === "new-file" || id === "new-dir") void startEdit(id);
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
        initial={editing.kind === "new-file" ? "untitled.md" : "untitled"}
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
      className="filetree"
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
              initial={entry.name}
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
              }${activeTab === entry.path ? " active" : ""}`}
              style={{ paddingLeft: `${depth * 0.85 + 0.5}rem` }}
              tabIndex={-1}
              onClick={() => activate(entry)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openContextAt(entry, { x: e.clientX, y: e.clientY });
              }}
            >
              {entry.isDir && (
                <span className={`tree-twist${expanded.has(entry.path) ? " open" : ""}`}>›</span>
              )}
              {entry.name}
            </button>
          )}
          {entry.isDir && editRowFor(entry.path, depth + 1)}
        </Fragment>
      ))}
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
