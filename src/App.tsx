import { useEffect, useState } from "react";
import { Editor } from "./editor/Editor.tsx";
import { EmptyState } from "./shell/EmptyState.tsx";
import { FileTree } from "./shell/FileTree.tsx";
import { QuickSwitcher } from "./shell/QuickSwitcher.tsx";
import { Tabs } from "./shell/Tabs.tsx";
import { TitleBar } from "./shell/TitleBar.tsx";
import "./shell/shell.css";
import { initialDocFor, useTabs } from "./store/tabs.ts";
import { useWorkspace } from "./store/workspace.ts";

export default function App() {
  const folder = useWorkspace((s) => s.folder);
  const active = useTabs((s) => s.active);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSwitcherOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TitleBar />
      {folder === null ? (
        <EmptyState />
      ) : (
        <div className="app-body">
          <FileTree />
          <main className="app-main">
            <Tabs />
            {active === null ? (
              <div className="no-tab">Select a file, or ⌘P</div>
            ) : (
              <Editor path={active} initialDoc={initialDocFor(active)} />
            )}
          </main>
        </div>
      )}
      {switcherOpen && folder !== null && <QuickSwitcher onClose={() => setSwitcherOpen(false)} />}
    </div>
  );
}
