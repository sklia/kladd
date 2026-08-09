import { useWorkspace } from "../store/workspace.ts";

export function EmptyState() {
  const recents = useWorkspace((s) => s.recents);
  const pickFolder = useWorkspace((s) => s.pickFolder);
  const openFolder = useWorkspace((s) => s.openFolder);
  const removeRecent = useWorkspace((s) => s.removeRecent);

  return (
    <div className="empty">
      <h1>kladd</h1>
      <button type="button" className="empty-open" onClick={() => void pickFolder()}>
        Open Folder…
      </button>
      {recents.length > 0 && (
        <ul className="empty-recents">
          {recents.map((r) => (
            <li key={r}>
              <button type="button" onClick={() => void openFolder(r)}>
                {r.split("/").pop()}
                <span className="menu-path">{r}</span>
              </button>
              <button
                type="button"
                className="recent-remove"
                aria-label={`Remove ${r} from recents`}
                onClick={() => removeRecent(r)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
