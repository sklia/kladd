import { describe, expect, it } from "vite-plus/test";
import { minimalDiff } from "./minimalDiff.ts";

function apply(oldText: string, span: { from: number; to: number; insert: string }) {
  return oldText.slice(0, span.from) + span.insert + oldText.slice(span.to);
}

describe("minimalDiff", () => {
  it("returns null for equal texts", () => {
    expect(minimalDiff("same", "same")).toBeNull();
  });

  it("append keeps the untouched prefix out of the span", () => {
    const span = minimalDiff("# doc\n", "# doc\nnew line\n");
    expect(span).toEqual({ from: 6, to: 6, insert: "new line\n" });
  });

  it("prepend keeps the untouched suffix out of the span", () => {
    const span = minimalDiff("body", "intro\nbody");
    expect(span).toEqual({ from: 0, to: 0, insert: "intro\n" });
  });

  it("mid-document edit trims both sides", () => {
    const span = minimalDiff("a WRONG z", "a right z");
    expect(span).toEqual({ from: 2, to: 7, insert: "right" });
  });

  it("round-trips arbitrary pairs", () => {
    const pairs: [string, string][] = [
      ["", "hello"],
      ["hello", ""],
      ["aaa", "aa"],
      ["abcabc", "abcxabc"],
      ["line1\nline2\n", "line1\nchanged\nline2\n"],
      ["🙂 emoji", "🙂 emojis"],
    ];
    for (const [oldText, newText] of pairs) {
      const span = minimalDiff(oldText, newText);
      expect(span === null ? oldText : apply(oldText, span)).toBe(newText);
    }
  });
});
