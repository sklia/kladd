import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, type RangeSet } from "@codemirror/state";
import type { Decoration } from "@codemirror/view";
import { describe, expect, it } from "vite-plus/test";
import { buildDecorations } from "./livePreview.ts";

// The second set returned by buildDecorations holds exactly the hidden
// (replaced) ranges, so asserting on it pins the reveal behavior.
function hiddenRanges(doc: string, cursor: number): [number, number][] {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(cursor),
    extensions: [markdown({ base: markdownLanguage })],
  });
  ensureSyntaxTree(state, doc.length, 1000);
  const [, atomics] = buildDecorations(state, [{ from: 0, to: doc.length }]);
  const out: [number, number][] = [];
  const iter = (atomics as RangeSet<Decoration>).iter();
  while (iter.value) {
    out.push([iter.from, iter.to]);
    iter.next();
  }
  return out;
}

describe("live preview reveal", () => {
  it("hides emphasis marks when the selection is elsewhere", () => {
    const doc = "**bold**\n\nelsewhere";
    expect(hiddenRanges(doc, doc.length)).toEqual([
      [0, 2],
      [6, 8],
    ]);
  });

  it("reveals raw marks on the active line", () => {
    expect(hiddenRanges("**bold**\n\nelsewhere", 3)).toEqual([]);
  });

  it("hides the heading mark with its trailing space", () => {
    expect(hiddenRanges("# heading\n\nelsewhere", 12)).toEqual([[0, 2]]);
  });

  it("reveals a fenced code block as a unit", () => {
    const doc = "```ts\nlet x = 1;\n```\n\nelsewhere";
    // Cursor elsewhere: both fences and the info string are hidden.
    expect(hiddenRanges(doc, doc.length).length).toBeGreaterThan(0);
    // Cursor on a code line (not the fence lines): whole block revealed.
    expect(hiddenRanges(doc, 8)).toEqual([]);
  });

  it("keeps a link collapsed until the selection touches the link itself", () => {
    const doc = "read [it](https://a.b) now\n\nelsewhere";
    // Cursor on the same line but before the link: still collapsed.
    expect(hiddenRanges(doc, 0).length).toBeGreaterThan(0);
    // Cursor inside the link text: fully revealed.
    expect(hiddenRanges(doc, 6)).toEqual([]);
  });

  it("hides the list mark and task marker of a task item", () => {
    const doc = "- [ ] todo\n\nelsewhere";
    expect(hiddenRanges(doc, doc.length)).toEqual([
      [0, 2],
      [2, 5],
    ]);
  });

  it("promotes the whole blockquote when one line is active", () => {
    const doc = "> one\n> two\n\nelsewhere";
    expect(hiddenRanges(doc, 2)).toEqual([]);
    expect(hiddenRanges(doc, doc.length)).toEqual([
      [0, 2],
      [6, 8],
    ]);
  });
});
