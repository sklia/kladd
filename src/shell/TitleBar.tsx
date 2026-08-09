import { useState } from "react";
import { useWorkspace } from "../store/workspace.ts";

export function TitleBar() {
  const folder = useWorkspace((s) => s.folder);
  const folderName = useWorkspace((s) => s.folderName);
  const recents = useWorkspace((s) => s.recents);
  const pickFolder = useWorkspace((s) => s.pickFolder);
  const openFolder = useWorkspace((s) => s.openFolder);
  const [menuOpen, setMenuOpen] = useState(false);

  const choose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <header className="titlebar" data-tauri-drag-region="deep">
      <button type="button" className="titlebar-folder" onClick={() => setMenuOpen(!menuOpen)}>
        {folder === null ? "kladd" : folderName}
        <span className="titlebar-caret">▾</span>
      </button>
      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="titlebar-menu">
            <button type="button" onClick={() => choose(pickFolder)}>
              Open Folder…
            </button>
            {recents.filter((r) => r !== folder).length > 0 && <hr />}
            {recents
              .filter((r) => r !== folder)
              .map((r) => (
                <button type="button" key={r} onClick={() => choose(() => openFolder(r))}>
                  {r.split("/").pop()}
                  <span className="menu-path">{r}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </header>
  );
}
