import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useGit } from "../store/git.ts";
import { useWorkspace } from "../store/workspace.ts";
import { Overlay } from "./Overlay.tsx";

/** "Publish to GitHub…": creates the repo under the authenticated gh user,
 * wires it as origin, pushes the current branch. Auth comes from the gh
 * CLI; kladd stores no tokens. */
export function PublishDialog({ onClose }: { onClose: () => void }) {
  const folderName = useWorkspace((s) => s.folderName);
  const busy = useGit((s) => s.busy);
  const error = useGit((s) => s.error);
  const publish = useGit((s) => s.publish);
  const [name, setName] = useState(folderName);
  const [isPrivate, setIsPrivate] = useState(true);
  const [ghReady, setGhReady] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    void invoke<boolean>("github_cli_ready")
      .then(setGhReady)
      .catch(() => setGhReady(false));
  }, []);

  const create = async () => {
    if (busy || name.trim() === "" || ghReady === false) return;
    if (await publish(name.trim(), isPrivate)) onClose();
  };

  return (
    <Overlay onClose={onClose} className="clone-dialog">
      <h2 className="commit-title">Publish to GitHub</h2>
      {ghReady === false && (
        <p className="commit-error">
          The GitHub CLI is required: install gh, then run “gh auth login” once.
        </p>
      )}
      <input
        ref={inputRef}
        className="switcher-input clone-url"
        placeholder="repository name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
        }}
      />
      <div className="segmented publish-visibility" role="radiogroup" aria-label="Visibility">
        <button
          type="button"
          role="radio"
          aria-checked={isPrivate}
          className={isPrivate ? "selected" : ""}
          onClick={() => setIsPrivate(true)}
        >
          Private
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isPrivate}
          className={!isPrivate ? "selected" : ""}
          onClick={() => setIsPrivate(false)}
        >
          Public
        </button>
      </div>
      <p className="clone-parent">Creates the repo, adds it as origin, and pushes.</p>
      {error !== null && <p className="commit-error">{error}</p>}
      <div className="commit-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="accent"
          disabled={busy || name.trim() === "" || ghReady === false}
          onClick={() => void create()}
        >
          Create & Push
        </button>
      </div>
    </Overlay>
  );
}
