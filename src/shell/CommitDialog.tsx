import { useEffect, useMemo, useRef, useState } from "react";
import { useGit } from "../store/git.ts";
import { Overlay } from "./Overlay.tsx";

function statusLabel(change: { index: string; worktree: string }): string {
  if (change.worktree === "?") return "new";
  const s = change.index + change.worktree;
  if (s.includes("D")) return "deleted";
  if (s.includes("R")) return "renamed";
  if (s === "MM") return "staged + edited";
  if (change.index !== " ") return "staged";
  return "modified";
}

/** Commit dialog: message field plus the changed-file list; uncheck to
 * exclude. Cmd+Enter commits, Shift adds a push (Commit & Push button
 * mirrors it for mouse users). */
export function CommitDialog() {
  const branch = useGit((s) => s.branch);
  const changes = useGit((s) => s.changes);
  const busy = useGit((s) => s.busy);
  const error = useGit((s) => s.error);
  const setDialogOpen = useGit((s) => s.setDialogOpen);
  const commit = useGit((s) => s.commit);
  const [message, setMessage] = useState("");
  // Everything starts included; unchecking is the exclusion gesture.
  const [included, setIncluded] = useState<Set<string>>(() => new Set(changes.map((c) => c.path)));
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messageRef.current?.focus();
  }, []);

  const anyIncluded = useMemo(() => included.size > 0, [included]);
  const doCommit = (andPush: boolean) => {
    // Bail only when a commit is already running or there's nothing to do;
    // this was inverted once and made the buttons dead. Don't re-invert.
    if (busy || !anyIncluded || message.trim() === "") return;
    void commit(message.trim(), [...included], andPush);
  };

  const toggle = (path: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <Overlay onClose={() => setDialogOpen(false)} className="commit-dialog">
      <h2 className="commit-title">
        Commit <span className="commit-branch">{branch ?? ""}</span>
      </h2>
      <ul className="commit-files" role="group" aria-label="Changed files">
        {changes.map((c) => (
          <li key={c.path}>
            <label className="commit-file">
              <input
                type="checkbox"
                checked={included.has(c.path)}
                onChange={() => toggle(c.path)}
              />
              <span className="commit-path">{c.path}</span>
              <span className="commit-status">{statusLabel(c)}</span>
            </label>
          </li>
        ))}
      </ul>
      <textarea
        ref={messageRef}
        className="commit-message"
        placeholder="Commit message"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            doCommit(e.shiftKey);
          }
        }}
      />
      {error !== null && <p className="commit-error">{error}</p>}
      <div className="commit-actions">
        <button type="button" onClick={() => setDialogOpen(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="accent"
          disabled={!anyIncluded || busy || message.trim() === ""}
          onClick={() => doCommit(false)}
        >
          {busy ? "Committing…" : "Commit"}
        </button>
        <button
          type="button"
          className="accent"
          disabled={!anyIncluded || busy || message.trim() === ""}
          onClick={() => doCommit(true)}
        >
          Commit & Push
        </button>
      </div>
    </Overlay>
  );
}
