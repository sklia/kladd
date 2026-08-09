import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vite-plus/test";
import { parseAlignments, tables } from "./tables.ts";

const DOC = `before

| Name | Score |
| :--- | ----: |
| *a*  | 1     |

after`;

function stateWithCursor(anchor: number) {
  const state = EditorState.create({
    doc: DOC,
    selection: EditorSelection.single(anchor),
    extensions: [markdown({ base: markdownLanguage }), tables],
  });
  ensureSyntaxTree(state, DOC.length, 1000);
  // Recompute the field against the fully parsed tree.
  return state.update({ selection: EditorSelection.single(anchor) }).state;
}

describe("parseAlignments", () => {
  it("reads left, center, and right markers", () => {
    expect(parseAlignments("| :--- | :--: | ---: |")).toEqual(["left", "center", "right"]);
    expect(parseAlignments("--- | ---")).toEqual(["left", "left"]);
  });
});

describe("tables field", () => {
  it("replaces the table when the selection is elsewhere", () => {
    const state = stateWithCursor(0);
    let widgets = 0;
    state.field(tables).between(0, DOC.length, () => {
      widgets++;
    });
    expect(widgets).toBe(1);
  });

  it("reveals raw source when the selection touches the table", () => {
    const inTable = DOC.indexOf("Score");
    const state = stateWithCursor(inTable);
    let widgets = 0;
    state.field(tables).between(0, DOC.length, () => {
      widgets++;
    });
    expect(widgets).toBe(0);
  });
});
