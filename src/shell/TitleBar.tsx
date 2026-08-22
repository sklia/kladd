import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { githubUrl } from "../lib/githubUrl.ts";
import { useGit } from "../store/git.ts";
import { toastError } from "../store/toasts.ts";
import { useWorkspace } from "../store/workspace.ts";
import { Menu, type MenuEntry } from "./Menu.tsx";
import { Tabs } from "./Tabs.tsx";

export function TitleBar() {
  const folder = useWorkspace((s) => s.folder);
  const folderName = useWorkspace((s) => s.folderName);
  const recents = useWorkspace((s) => s.recents);
  const pickFolder = useWorkspace((s) => s.pickFolder);
  const openFolder = useWorkspace((s) => s.openFolder);
  const git = useGit();
  const button = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void useGit.getState().refresh();
  }, [folder]);

  const removeRecent = useWorkspace((s) => s.removeRecent);
  const otherRecents = recents.filter((r) => r !== folder);
  const repoUrl = git.repo && git.remoteUrl !== null ? githubUrl(git.remoteUrl) : null;
  const entries: MenuEntry[] = [
    { id: "open", label: "Open Folder…", hint: "⌘O" },
    ...(folder !== null && git.repo
      ? ([
          {
            id: "git-commit",
            label: git.changes.length > 0 ? `Commit… (${git.changes.length})` : "Commit…",
          },
          { id: "git-pull", label: "Pull" },
          ...(git.remoteUrl !== null ? [{ id: "git-push", label: "Push" }] : []),
          ...(repoUrl !== null ? [{ id: "git-github", label: "Open on GitHub" }] : []),
          ...(git.remoteUrl === null ? [{ id: "git-publish", label: "Publish to GitHub…" }] : []),
        ] as MenuEntry[])
      : []),
    ...(folder !== null && !git.repo
      ? ([{ id: "git-init", label: "Initialize Repository" }] as MenuEntry[])
      : []),
    { id: "git-clone", label: "Clone from URL…" },
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
          <span className="titlebar-name">{folder === null ? "kladd" : folderName}</span>
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
            else if (id === "git-commit") useGit.getState().setDialogOpen(true);
            else if (id === "git-pull") void useGit.getState().pull();
            else if (id === "git-push") void useGit.getState().push();
            else if (id === "git-init") {
              if (folder !== null)
                invoke("git_init", { root: folder })
                  .then(() => useGit.getState().refresh())
                  .catch((e) => toastError(`git init failed: ${e}`));
            } else if (id === "git-clone") useGit.getState().setCloneOpen(true);
            else if (id === "git-publish") useGit.getState().setPublishOpen(true);
            else if (id === "git-github" && repoUrl !== null)
              void invoke("open_url", { url: repoUrl });
            else void openFolder(id);
          }}
          onRemove={removeRecent}
        />
      )}
    </header>
  );
}
