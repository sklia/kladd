import { useTabs } from "../store/tabs.ts";
import { type DirEntry, useWorkspace } from "../store/workspace.ts";

function TreeNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const expanded = useWorkspace((s) => s.expanded.has(entry.path));
  const children = useWorkspace((s) => s.entries[entry.path]);
  const toggleDir = useWorkspace((s) => s.toggleDir);
  const openTab = useTabs((s) => s.openTab);
  const active = useTabs((s) => s.active === entry.path);

  const indent = { paddingLeft: `${depth * 0.85 + 0.5}rem` };

  if (entry.isDir) {
    return (
      <>
        <button
          type="button"
          className="tree-row tree-dir"
          style={indent}
          onClick={() => toggleDir(entry.path)}
        >
          <span className={`tree-twist${expanded ? " open" : ""}`}>›</span>
          {entry.name}
        </button>
        {expanded &&
          children?.map((child) => <TreeNode key={child.path} entry={child} depth={depth + 1} />)}
      </>
    );
  }
  return (
    <button
      type="button"
      className={`tree-row${active ? " active" : ""}`}
      style={indent}
      onClick={() => openTab(entry.path)}
    >
      {entry.name}
    </button>
  );
}

export function FileTree() {
  const folder = useWorkspace((s) => s.folder);
  const roots = useWorkspace((s) => (s.folder === null ? undefined : s.entries[s.folder]));

  if (folder === null) return null;
  return (
    <nav className="filetree">
      {roots?.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={0} />
      ))}
    </nav>
  );
}
