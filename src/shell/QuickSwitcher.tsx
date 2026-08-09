import { useMemo, useState } from "react";
import { fuzzyFilterBy } from "../lib/fuzzy.ts";
import { stripExt } from "../lib/names.ts";
import { useTabs } from "../store/tabs.ts";
import { useWorkspace } from "../store/workspace.ts";
import { Overlay } from "./Overlay.tsx";

export function QuickSwitcher({ onClose }: { onClose: () => void }) {
  const folder = useWorkspace((s) => s.folder);
  const files = useWorkspace((s) => s.files);
  const openTab = useTabs((s) => s.openTab);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  // Matches the display title and the real path both.
  const hits = useMemo(
    () => fuzzyFilterBy(query, files, (f) => [f.title, f.rel], 12),
    [query, files],
  );
  const clamped = Math.min(selected, Math.max(hits.length - 1, 0));

  const openHit = (rel: string) => {
    onClose();
    void openTab(`${folder}/${rel}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSelected(Math.min(clamped + 1, hits.length - 1));
    else if (e.key === "ArrowUp") setSelected(Math.max(clamped - 1, 0));
    else if (e.key === "Enter" && hits[clamped] !== undefined) openHit(hits[clamped].rel);
    else return;
    e.preventDefault();
  };

  return (
    <Overlay onClose={onClose} className="switcher">
      <div onKeyDown={onKeyDown}>
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
          {hits.map((hit, i) => (
            <li key={hit.rel}>
              <button
                type="button"
                className={i === clamped ? "selected" : ""}
                onMouseEnter={() => setSelected(i)}
                onClick={() => openHit(hit.rel)}
              >
                {hit.title ?? stripExt(hit.rel.split("/").pop() ?? hit.rel)}
                <span className="menu-path">{hit.rel}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Overlay>
  );
}
