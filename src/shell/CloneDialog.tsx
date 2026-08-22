import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../store/workspace.ts";
import { Overlay } from "./Overlay.tsx";

/** "Clone from URL…": paste a remote URL, pick a parent folder, kladd
 * clones and opens it. */
export function CloneDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clone = async () => {
    if (parent === null || url.trim() === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const path = await invoke<string>("git_clone", { url: url.trim(), parent });
      onClose();
      await useWorkspace.getState().openFolder(path);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} className="clone-dialog">
      <h2 className="commit-title">Clone from URL</h2>
      <input
        ref={inputRef}
        className="switcher-input clone-url"
        placeholder="https://github.com/you/repo.git"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void clone();
        }}
      />
      <div className="clone-dest">
        <button
          type="button"
          onClick={() =>
            void open({ directory: true }).then((p) => typeof p === "string" && setParent(p))
          }
        >
          Choose folder…
        </button>
        <span className="clone-parent">{parent === null ? "no destination chosen" : parent}</span>
      </div>
      {error !== null && <p className="commit-error">{error}</p>}
      <div className="commit-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="accent"
          disabled={busy || url.trim() === "" || parent === null}
          onClick={() => void clone()}
        >
          Clone
        </button>
      </div>
    </Overlay>
  );
}
