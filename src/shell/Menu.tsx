import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  id: string;
  label: string;
  /** Right-aligned shortcut hint, e.g. "⌘N". */
  hint?: string;
  /** Secondary line under the label, e.g. a folder path. */
  detail?: string;
  danger?: boolean;
}

export type MenuEntry = MenuItem | "separator";

const isItem = (e: MenuEntry): e is MenuItem => e !== "separator";

/** The one menu: anchored popover with full keyboard navigation.
 * Used by the title bar dropdown and the file tree context menu. */
export function Menu({
  entries,
  anchor,
  onSelect,
  onClose,
}: {
  entries: MenuEntry[];
  /** Viewport coordinates of the top-left corner. */
  anchor: { x: number; y: number };
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const items = entries.filter(isItem);
  const [active, setActive] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    host.current?.focus();
    // Clamp into the viewport after first paint.
    const el = host.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const overX = rect.right - window.innerWidth + 8;
    const overY = rect.bottom - window.innerHeight + 8;
    if (overX > 0) el.style.left = `${anchor.x - overX}px`;
    if (overY > 0) el.style.top = `${anchor.y - rect.height}px`;
  }, [anchor]);

  const pick = (id: string) => {
    onClose();
    onSelect(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, items.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(items.length - 1);
    else if ((e.key === "Enter" || e.key === " ") && items[active] !== undefined) {
      pick(items[active].id);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  let itemIndex = -1;
  return (
    <>
      <div
        className="menu-backdrop"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={host}
        className="menu"
        style={{ left: anchor.x, top: anchor.y }}
        role="menu"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {entries.map((entry, i) => {
          if (!isItem(entry)) return <hr key={`sep-${i}`} />;
          itemIndex++;
          const index = itemIndex;
          return (
            <button
              type="button"
              role="menuitem"
              key={entry.id}
              className={`menu-item${index === active ? " active" : ""}${entry.danger ? " danger" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(entry.id)}
            >
              <span className="menu-row">
                <span className="menu-label">{entry.label}</span>
                {entry.hint !== undefined && <span className="menu-hint">{entry.hint}</span>}
              </span>
              {entry.detail !== undefined && <span className="menu-path">{entry.detail}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
