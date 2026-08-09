import { stripExt } from "../lib/names.ts";
import { useTabs } from "../store/tabs.ts";
import { useWorkspace } from "../store/workspace.ts";

export function Tabs() {
  const tabs = useTabs((s) => s.tabs);
  const titles = useWorkspace((s) => s.titles);
  const active = useTabs((s) => s.active);
  const setActive = useTabs((s) => s.setActive);
  const closeTab = useTabs((s) => s.closeTab);

  if (tabs.length === 0) return null;
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          role="tab"
          aria-selected={tab.path === active}
          className={`tab${tab.path === active ? " active" : ""}`}
          onMouseDown={(e) => {
            // Middle click closes, like every editor since forever.
            if (e.button === 1) closeTab(tab.path);
            else setActive(tab.path);
          }}
        >
          <span className="tab-name">{titles[tab.path] ?? stripExt(tab.name)}</span>
          <button
            type="button"
            className="tab-close"
            aria-label={`Close ${tab.name}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              closeTab(tab.path);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
