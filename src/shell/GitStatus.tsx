import { useGit } from "../store/git.ts";

/** Sidebar footer status: branch, dirty count, what's running, errors.
 * The one place repo state lives; click opens the commit dialog. */
export function GitStatus() {
  const git = useGit();
  if (!git.repo) return null;
  return (
    <div className="git-status">
      <button
        type="button"
        className={`git-chip${git.error !== null ? " error" : ""}`}
        title={git.error ?? (git.changes.length > 0 ? `${git.changes.length} changed` : "clean")}
        onClick={() => useGit.getState().setDialogOpen(true)}
      >
        {git.busy ? (
          <>
            <span className="git-busy-dot" aria-hidden="true" />
            {git.busyLabel}…
          </>
        ) : (
          <>
            ⎇ {git.branch ?? "HEAD"}
            {git.changes.length > 0 && <span className="git-dirty">{git.changes.length}</span>}
          </>
        )}
      </button>
    </div>
  );
}
