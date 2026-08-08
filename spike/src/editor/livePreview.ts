import { syntaxTree } from "@codemirror/language";
import { RangeSet, type EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

// Live preview: the document is always plain markdown; everything below is
// view-layer decoration. Raw syntax is revealed on lines the selection
// touches, rendered everywhere else.

const hidden = Decoration.replace({});

const marks = {
  strong: Decoration.mark({ class: "cm-strong" }),
  em: Decoration.mark({ class: "cm-em" }),
  strike: Decoration.mark({ class: "cm-strike" }),
  inlineCode: Decoration.mark({ class: "cm-inline-code" }),
  link: Decoration.mark({ class: "cm-link" }),
  listMark: Decoration.mark({ class: "cm-list-mark" }),
};

const lines = {
  h1: Decoration.line({ class: "cm-h1" }),
  h2: Decoration.line({ class: "cm-h2" }),
  h3: Decoration.line({ class: "cm-h3" }),
  h4: Decoration.line({ class: "cm-h4" }),
  h5: Decoration.line({ class: "cm-h5" }),
  h6: Decoration.line({ class: "cm-h6" }),
  blockquote: Decoration.line({ class: "cm-blockquote" }),
  codeblock: Decoration.line({ class: "cm-codeblock" }),
};

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

class CheckboxWidget extends WidgetType {
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

const bullet = new BulletWidget();

function toggleTask(view: EditorView, pos: number) {
  // pos is TaskMarker.from; the char between the brackets is at pos + 1
  const current = view.state.doc.sliceString(pos + 1, pos + 2);
  view.dispatch({
    changes: { from: pos + 1, to: pos + 2, insert: current === " " ? "x" : " " },
  });
  return true;
}

function activeLines(state: EditorState): Set<number> {
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) active.add(n);
  }
  return active;
}

function build(view: EditorView): [DecorationSet, DecorationSet] {
  const { state } = view;
  const { doc } = state;
  const deco: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const active = activeLines(state);

  const touchesSelection = (from: number, to: number) =>
    state.selection.ranges.some((r) => r.from <= to && from <= r.to);

  const lineIsActive = (from: number, to: number) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) if (active.has(n)) return true;
    return false;
  };

  // Multi-line blocks reveal as a unit: a selection on any of their lines
  // promotes all of their lines to active before children are visited.
  const promote = (from: number, to: number) => {
    if (!lineIsActive(from, to)) return;
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) active.add(n);
  };

  // A view plugin may not emit replace decorations that cross line breaks,
  // so every hide is split into per-line segments.
  const hide = (from: number, to: number) => {
    let pos = from;
    while (pos < to) {
      const end = Math.min(to, doc.lineAt(pos).to);
      if (end > pos) {
        deco.push(hidden.range(pos, end));
        atomic.push(hidden.range(pos, end));
      }
      pos = end + 1;
    }
  };

  const replaceWith = (from: number, to: number, widget: WidgetType) => {
    const d = Decoration.replace({ widget });
    deco.push(d.range(from, to));
    atomic.push(hidden.range(from, to));
  };

  // Header/quote marks swallow their trailing space, or hidden lines read
  // as indented by one.
  const pastTrailingSpace = (to: number) => (doc.sliceString(to, to + 1) === " " ? to + 1 : to);

  const eachLine = (from: number, to: number, deco_: Decoration) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) deco.push(deco_.range(doc.line(n).from));
  };

  for (const range of view.visibleRanges) {
    syntaxTree(state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        const { name, from, to } = node;
        // Images share URL/LinkMark node names with links; out of scope, stay raw.
        if (name === "Image") return false;

        const heading = /^ATXHeading(\d)$/.exec(name);
        if (heading) {
          eachLine(from, from, lines[`h${heading[1]}` as keyof typeof lines]);
          return;
        }

        switch (name) {
          case "HeaderMark":
            // Also matches Setext underlines (=== / ---); those stay raw.
            if (doc.sliceString(from, from + 1) !== "#") return;
            if (!lineIsActive(from, to)) hide(from, pastTrailingSpace(to));
            return;

          case "StrongEmphasis":
            deco.push(marks.strong.range(from, to));
            return;
          case "Emphasis":
            deco.push(marks.em.range(from, to));
            return;
          case "Strikethrough":
            deco.push(marks.strike.range(from, to));
            return;
          case "InlineCode":
            deco.push(marks.inlineCode.range(from, to));
            return;

          case "EmphasisMark":
          case "StrikethroughMark":
          case "CodeMark":
          case "CodeInfo": {
            const parent = node.node.parent;
            if (parent && !lineIsActive(parent.from, parent.to)) hide(from, to);
            return;
          }

          case "Link":
            deco.push(marks.link.range(from, to));
            return;
          case "LinkMark":
          case "URL":
          case "LinkTitle": {
            // Link-scoped reveal: only when the selection touches the link
            // itself, not elsewhere on the line. Autolinks stay as-is.
            const link = node.node.parent;
            if (link?.name !== "Link") return;
            if (!touchesSelection(link.from, link.to)) hide(from, to);
            return;
          }

          case "Blockquote":
            promote(from, to);
            eachLine(from, to, lines.blockquote);
            return;
          case "QuoteMark":
            if (!lineIsActive(from, to)) hide(from, pastTrailingSpace(to));
            return;

          case "FencedCode":
            promote(from, to);
            eachLine(from, to, lines.codeblock);
            return;

          case "ListMark": {
            if (lineIsActive(from, to)) return;
            if (node.node.nextSibling?.name === "Task") {
              // Task items show only the checkbox; the "- " goes away.
              hide(from, pastTrailingSpace(to));
            } else if (/[-*+]/.test(doc.sliceString(from, to))) {
              replaceWith(from, to, bullet);
            } else {
              deco.push(marks.listMark.range(from, to));
            }
            return;
          }

          case "TaskMarker": {
            if (lineIsActive(from, to)) return;
            const checked = /[xX]/.test(doc.sliceString(from + 1, from + 2));
            replaceWith(from, to, new CheckboxWidget(checked));
            return;
          }
        }
      },
    });
  }

  return [Decoration.set(deco, true), Decoration.set(atomic, true)];
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomics: DecorationSet;
    constructor(view: EditorView) {
      [this.decorations, this.atomics] = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        [this.decorations, this.atomics] = build(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomics ?? RangeSet.empty),
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        if (target.nodeName === "INPUT" && target.parentElement?.classList.contains("cm-task")) {
          return toggleTask(view, view.posAtDOM(target.parentElement));
        }
      },
    },
  },
);
