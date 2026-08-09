import { describe, expect, it } from "vite-plus/test";
import { fuzzyFilter, fuzzyScore } from "./fuzzy.ts";

describe("fuzzyScore", () => {
  it("matches subsequences case-insensitively", () => {
    expect(fuzzyScore("plan", "PLAN.md")).not.toBeNull();
    expect(fuzzyScore("xyz", "PLAN.md")).toBeNull();
  });

  it("empty query matches everything", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("prefers consecutive and segment-start matches", () => {
    const ranked = fuzzyFilter("lp", ["src/editor/livePreview.ts", "src/lib/help.ts"]);
    expect(ranked[0]).toBe("src/editor/livePreview.ts");
  });

  it("prefers file-name hits over directory hits", () => {
    const ranked = fuzzyFilter("editor", ["src/editor/theme.css", "src/Editor.tsx"]);
    expect(ranked[0]).toBe("src/Editor.tsx");
  });

  it("filters and limits", () => {
    const targets = Array.from({ length: 100 }, (_, i) => `file${i}.md`);
    expect(fuzzyFilter("file", targets, 10)).toHaveLength(10);
    expect(fuzzyFilter("nope-q-z", targets)).toHaveLength(0);
  });
});
