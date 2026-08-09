import { describe, expect, it } from "vite-plus/test";
import { parentDir, visibleRows } from "./tree.ts";

const entries = {
  "/root": [
    { name: "docs", path: "/root/docs", isDir: true },
    { name: "a.md", path: "/root/a.md", isDir: false },
  ],
  "/root/docs": [{ name: "b.md", path: "/root/docs/b.md", isDir: false }],
};

describe("visibleRows", () => {
  it("hides children of collapsed dirs", () => {
    const rows = visibleRows("/root", entries, new Set());
    expect(rows.map((r) => r.entry.name)).toEqual(["docs", "a.md"]);
  });

  it("includes expanded children with depth", () => {
    const rows = visibleRows("/root", entries, new Set(["/root/docs"]));
    expect(rows.map((r) => [r.entry.name, r.depth])).toEqual([
      ["docs", 0],
      ["b.md", 1],
      ["a.md", 0],
    ]);
  });
});

describe("parentDir", () => {
  it("returns the containing directory", () => {
    expect(parentDir("/root/docs/b.md")).toBe("/root/docs");
  });
});
