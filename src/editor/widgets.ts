import { convertFileSrc } from "@tauri-apps/api/core";
import { EditorView, WidgetType } from "@codemirror/view";

/** Renders an inline markdown image. Path resolution happens in toDOM, not
 * at decoration-build time, so buildDecorations stays pure and testable
 * without the Tauri runtime (convertFileSrc needs it). */
export class ImageWidget extends WidgetType {
  src: string;
  dir: string;
  alt: string;
  constructor(src: string, dir: string, alt: string) {
    super();
    this.src = src;
    this.dir = dir;
    this.alt = alt;
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.dir === this.dir && other.alt === this.alt;
  }
  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-image";
    img.alt = this.alt;
    img.title = this.alt;
    img.loading = "lazy";
    if (/^[a-z][a-z0-9+.-]*:/i.test(this.src) || this.src.startsWith("//")) {
      img.src = this.src;
    } else {
      const abs = this.src.startsWith("/") ? this.src : `${this.dir}/${this.src}`;
      try {
        img.src = convertFileSrc(abs);
      } catch {
        // Outside Tauri (browser dev): nothing sensible to load.
      }
    }
    return img;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-bullet";
    span.textContent = "•";
    return span;
  }
}

export const bullet = new BulletWidget();

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-hr";
    return span;
  }
}

export const hr = new HrWidget();

export class CheckboxWidget extends WidgetType {
  checked: boolean;
  constructor(checked: boolean) {
    super();
    this.checked = checked;
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-task";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    wrap.append(box);
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

export function toggleTask(view: EditorView, pos: number) {
  // pos is TaskMarker.from; the char between the brackets is at pos + 1
  const current = view.state.doc.sliceString(pos + 1, pos + 2);
  view.dispatch({
    changes: { from: pos + 1, to: pos + 2, insert: current === " " ? "x" : " " },
  });
  return true;
}
