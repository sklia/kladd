import { useMemo, useState } from "react";
import { fuzzyFilter } from "../lib/fuzzy.ts";
import { useTabs } from "../store/tabs.ts";
import { useWorkspace } from "../store/workspace.ts";

export function QuickSwitcher({ onClose }: { onClose: () => void }) {
  const folder = useWorkspace((s) => s.folder);
  const files = useWorkspace((s) => s.files);
  const openTab = useTabs((s) => s.openTab);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const hits = useMemo(() => fuzzyFilter(query, files, 12), [query, files]);
  const clamped = Math.min(selected, Math.max(hits.length - 1, 0));

  const openHit = (rel: string) => {
    onClose();
    void openTab(`${folder}/${rel}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") setSelected(Math.min(clamped + 1, hits.length - 1));
    else if (e.key === "ArrowUp") setSelected(Math.max(clamped - 1, 0));
    else if (e.key === "Enter" && hits[clamped] !== undefined) openHit(hits[clamped]);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="switcher" onKeyDown={onKeyDown}>
        <input
          autoFocus
          className="switcher-input"
          placeholder="Go to file…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
        />
        <ul className="switcher-list">
          {hits.map((rel, i) => (
            <li key={rel}>
              <button
                type="button"
                className={i === clamped ? "selected" : ""}
                onMouseEnter={() => setSelected(i)}
                onClick={() => openHit(rel)}
              >
                {rel}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
