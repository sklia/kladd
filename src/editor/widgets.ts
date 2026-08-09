import { EditorView, WidgetType } from "@codemirror/view";

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
