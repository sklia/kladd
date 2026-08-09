import { useEffect, useRef, useState } from "react";
import { isUnder, parentDir } from "../lib/tree.ts";
import { moveEntry } from "../store/fileOps.ts";
import { type DirEntry, useWorkspace } from "../store/workspace.ts";

export interface DragState {
  entry: DirEntry;
  x: number;
  y: number;
  /** Valid drop directory under the cursor, or null. */
  over: string | null;
}

const DRAG_THRESHOLD_PX = 4;
const SPRING_LOAD_MS = 600;

/** Pointer-based drag-to-move for the file tree. Pointer, not HTML5 dnd:
 * the browser's drag ghost can't be animated, and the motion is the point.
 * The ghost has pointer-events: none, so elementFromPoint sees through it. */
export function useTreeDrag(folder: string) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pressed = useRef<{ entry: DirEntry; x: number; y: number } | null>(null);
  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const springTarget = useRef<string | null>(null);
  const dropped = useRef(false);

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  useEffect(() => {
    const dropTargetAt = (x: number, y: number, dragged: DirEntry): string | null => {
      const el = document.elementFromPoint(x, y);
      const rowEl = el?.closest("[data-path]") ?? null;
      let dir: string | null = null;
      if (rowEl !== null) {
        const path = rowEl.getAttribute("data-path") ?? "";
        const entry = useWorkspace
          .getState()
          .entries[parentDir(path)]?.find((e) => e.path === path);
        if (entry === undefined) return null;
        dir = entry.isDir ? entry.path : parentDir(entry.path);
      } else if ((el?.closest(".filetree") ?? null) !== null) {
        dir = folder; // tree background drops at the workspace root
      }
      if (dir === null) return null;
      // Same parent, own subtree, or a name collision: not a target.
      if (dir === parentDir(dragged.path) || isUnder(dir, dragged.path)) return null;
      const children = useWorkspace.getState().entries[dir];
      if (children?.some((c) => c.name === dragged.name) === true) return null;
      return dir;
    };

    const clearSpring = () => {
      springTarget.current = null;
      if (springTimer.current !== null) clearTimeout(springTimer.current);
    };

    const onMove = (e: PointerEvent) => {
      const press = pressed.current;
      if (press === null) return;
      const current = dragRef.current;
      if (current === null) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD_PX) return;
        update({ entry: press.entry, x: e.clientX, y: e.clientY, over: null });
        return;
      }
      const over = dropTargetAt(e.clientX, e.clientY, press.entry);
      update({ ...current, x: e.clientX, y: e.clientY, over });
      // Hovering a collapsed folder springs it open.
      const collapsed =
        over !== null && over !== folder && !useWorkspace.getState().expanded.has(over);
      if (collapsed && springTarget.current !== over) {
        clearSpring();
        springTarget.current = over;
        springTimer.current = setTimeout(() => {
          if (springTarget.current === over && dragRef.current !== null) {
            void useWorkspace.getState().toggleDir(over);
          }
        }, SPRING_LOAD_MS);
      } else if (!collapsed) {
        clearSpring();
      }
    };

    const onUp = () => {
      const current = dragRef.current;
      if (current !== null) {
        dropped.current = true;
        if (current.over !== null) void moveEntry(current.entry.path, current.over);
      }
      pressed.current = null;
      clearSpring();
      update(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current !== null) {
        pressed.current = null;
        clearSpring();
        update(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [folder]);

  return {
    drag,
    onRowPointerDown: (entry: DirEntry) => (e: React.PointerEvent) => {
      if (e.button === 0) pressed.current = { entry, x: e.clientX, y: e.clientY };
    },
    /** True exactly once after a drag ended; swallows the trailing click. */
    consumeDrop: () => {
      const was = dropped.current;
      dropped.current = false;
      return was;
    },
  };
}
