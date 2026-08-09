import { useEffect, useRef, useState } from "react";
import { Editor } from "./editor/Editor.tsx";
import { EmptyState } from "./shell/EmptyState.tsx";
import { FileTree } from "./shell/FileTree.tsx";
import { QuickSwitcher } from "./shell/QuickSwitcher.tsx";
import { SettingsPanel } from "./shell/SettingsPanel.tsx";
import { TitleBar } from "./shell/TitleBar.tsx";
import "./shell/shell.css";
import { applyTheme, SIDEBAR_DEFAULT, useSettings } from "./store/settings.ts";
import { initSync } from "./store/sync.ts";
import { initialDocFor, useTabs } from "./store/tabs.ts";
import { useWorkspace } from "./store/workspace.ts";

export default function App() {
  const folder = useWorkspace((s) => s.folder);
  const active = useTabs((s) => s.active);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Live width during a drag; persisted to settings on pointer-up.
  const [sidebarWidth, setSidebarWidth] = useState(() => useSettings.getState().sidebarWidth);
  const dragging = useRef(false);

  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setSidebarWidth(Math.min(420, Math.max(160, e.clientX)));
  };
  const onResizeUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    useSettings.getState().setSidebarWidth(sidebarWidth);
  };
  const resetSidebar = () => {
    setSidebarWidth(SIDEBAR_DEFAULT);
    useSettings.getState().setSidebarWidth(SIDEBAR_DEFAULT);
  };

  useEffect(() => initSync(), []);

  useEffect(() => {
    applyTheme(useSettings.getState().theme);
    return useSettings.subscribe((s) => applyTheme(s.theme));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const ws = useWorkspace.getState();
      if (e.key === "p") setSwitcherOpen((open) => !open);
      else if (e.key === "n") void ws.startEdit("new-file");
      else if (e.key === "o") void ws.pickFolder();
      else if (e.key === ",") setSettingsOpen((open) => !open);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app" style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}>
      <TitleBar />
      {folder === null ? (
        <EmptyState />
      ) : (
        <div className="app-body">
          <FileTree />
          <div
            className="sidebar-resize"
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onDoubleClick={resetSidebar}
          />
          <main className="app-main">
            {active === null ? (
              <div className="no-tab">Select a file, or ⌘P</div>
            ) : (
              <Editor path={active} initialDoc={initialDocFor(active)} />
            )}
          </main>
        </div>
      )}
      {switcherOpen && folder !== null && <QuickSwitcher onClose={() => setSwitcherOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
