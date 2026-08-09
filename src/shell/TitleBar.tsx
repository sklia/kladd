import { useRef, useState } from "react";
import { useWorkspace } from "../store/workspace.ts";
import { Menu, type MenuEntry } from "./Menu.tsx";
import { Tabs } from "./Tabs.tsx";

export function TitleBar() {
  const folder = useWorkspace((s) => s.folder);
  const folderName = useWorkspace((s) => s.folderName);
  const recents = useWorkspace((s) => s.recents);
  const pickFolder = useWorkspace((s) => s.pickFolder);
  const openFolder = useWorkspace((s) => s.openFolder);
  const button = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  const removeRecent = useWorkspace((s) => s.removeRecent);
  const otherRecents = recents.filter((r) => r !== folder);
  const entries: MenuEntry[] = [
    { id: "open", label: "Open Folder…", hint: "⌘O" },
    ...(otherRecents.length > 0 ? (["separator"] as const) : []),
    ...otherRecents.map((r) => ({
      id: r,
      label: r.split("/").pop() ?? r,
      detail: r,
      removable: true,
    })),
  ];

  const openMenu = () => {
    const rect = button.current?.getBoundingClientRect();
    if (rect !== undefined) setMenuAt({ x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <header className="titlebar" data-tauri-drag-region="deep">
      {/* Left segment shares the sidebar's width, so tabs align with the
          editor pane instead of floating over the tree. */}
      <div className={`titlebar-left${folder === null ? " no-folder" : ""}`}>
        <button ref={button} type="button" className="titlebar-folder" onClick={openMenu}>
          {folder === null ? "kladd" : folderName}
          <span className="titlebar-caret">▾</span>
        </button>
      </div>
      <Tabs />
      {menuAt !== null && (
        <Menu
          entries={entries}
          anchor={menuAt}
          onClose={() => {
            setMenuAt(null);
            button.current?.focus();
          }}
          onSelect={(id) => {
            if (id === "open") void pickFolder();
            else void openFolder(id);
          }}
          onRemove={removeRecent}
        />
      )}
    </header>
  );
}
