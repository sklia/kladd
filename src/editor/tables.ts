import { syntaxTree } from "@codemirror/language";
import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

type Align = "left" | "center" | "right";

/** Column alignments from the delimiter row: `:---`, `:--:`, `---:`. */
export function parseAlignments(delimiterRowText: string): Align[] {
  return delimiterRowText
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "")
    .map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      return "left";
    });
}

/** Cell content DOM straight from the syntax tree the parser already built:
 * inline marks styled with the same cm-* classes as the live preview. */
function renderInline(state: EditorState, node: SyntaxNode, parent: Node) {
  let pos = node.from;
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.from > pos)
      parent.appendChild(document.createTextNode(state.sliceDoc(pos, child.from)));
    pos = child.to;
    const wrap = (tag: string, cls: string) => {
      const el = document.createElement(tag);
      el.className = cls;
      renderInline(state, child, el);
      parent.appendChild(el);
    };
    switch (child.name) {
      case "EmphasisMark":
      case "StrikethroughMark":
      case "CodeMark":
      case "LinkMark":
      case "URL":
      case "LinkTitle":
        break; // formatting marks stay hidden in rendered cells
      case "StrongEmphasis":
        wrap("strong", "cm-strong");
        break;
      case "Emphasis":
        wrap("em", "cm-em");
        break;
      case "Strikethrough":
        wrap("span", "cm-strike");
        break;
      case "InlineCode":
        wrap("code", "cm-inline-code");
        break;
      case "Link":
        wrap("span", "cm-link");
        break;
      default:
        parent.appendChild(document.createTextNode(state.sliceDoc(child.from, child.to)));
    }
  }
  if (pos < node.to) parent.appendChild(document.createTextNode(state.sliceDoc(pos, node.to)));
}

class TableWidget extends WidgetType {
  source: string;
  state: EditorState;
  node: SyntaxNode;
  constructor(state: EditorState, node: SyntaxNode) {
    super();
    this.state = state;
    this.node = node;
    this.source = state.sliceDoc(node.from, node.to);
  }
  eq(other: TableWidget) {
    return other.source === this.source;
  }
  toDOM(view: EditorView) {
    const table = document.createElement("table");
    table.className = "cm-table";
    let alignments: Align[] = [];
    for (let row = this.node.firstChild; row !== null; row = row.nextSibling) {
      if (row.name === "TableDelimiter") {
        alignments = parseAlignments(this.state.sliceDoc(row.from, row.to));
        continue;
      }
      if (row.name !== "TableHeader" && row.name !== "TableRow") continue;
      const tr = document.createElement("tr");
      let col = 0;
      for (let cell = row.firstChild; cell !== null; cell = cell.nextSibling) {
        if (cell.name !== "TableCell") continue;
        const td = document.createElement(row.name === "TableHeader" ? "th" : "td");
        td.dataset.pos = String(cell.from);
        const align = alignments[col];
        if (align !== undefined && align !== "left") td.style.textAlign = align;
        renderInline(this.state, cell, td);
        tr.appendChild(td);
        col++;
      }
      table.appendChild(tr);
    }
    const scroll = document.createElement("div");
    scroll.className = "cm-table-scroll";
    scroll.appendChild(table);
    // Clicking a cell puts the cursor at that cell's source position,
    // which reveals the raw table for editing right where the user aimed.
    scroll.addEventListener("mousedown", (e) => {
      const cell = (e.target as HTMLElement).closest("[data-pos]") as HTMLElement | null;
      const anchor = cell === null ? this.node.from : Number(cell.dataset.pos);
      view.dispatch({ selection: { anchor } });
      view.focus();
      e.preventDefault();
    });
    return scroll;
  }
}

function build(state: EditorState): DecorationSet {
  const decorations: ReturnType<Decoration["range"]>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Table") return;
      // Selection inside the table reveals raw source for editing.
      const touched = state.selection.ranges.some((r) => r.from <= node.to && node.from <= r.to);
      if (touched) return false;
      decorations.push(
        Decoration.replace({
          widget: new TableWidget(state, node.node),
          block: true,
        }).range(node.from, node.to),
      );
      return false;
    },
  });
  return Decoration.set(decorations, true);
}

/** GFM tables as block widgets. A StateField, not a ViewPlugin: block
 * replace decorations must influence vertical layout (spike research). */
export const tables = StateField.define<DecorationSet>({
  create: build,
  update: (deco, tr) => (tr.docChanged || tr.selection !== undefined ? build(tr.state) : deco),
  provide: (f) => EditorView.decorations.from(f),
});
