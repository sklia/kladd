import { describe, expect, it } from "vite-plus/test";
import { frontmatterRange } from "./frontmatter.ts";

describe("frontmatterRange", () => {
  it("finds the block, keys, and display values", () => {
    const fm = frontmatterRange('---\ntitle: "Plan"\ntags: [a, b]\n---\n# Doc\n');
    expect(fm).not.toBeNull();
    expect(fm?.entries.map((e) => [e.key, e.value])).toEqual([
      ["title", "Plan"],
      ["tags", "a, b"],
    ]);
    expect(fm?.from).toBe(0);
  });

  it("marks nested/empty values and records line offsets", () => {
    const fm = frontmatterRange("---\nmeta:\n  inner: x\ndate: 2026\n---\n");
    expect(fm?.entries.map((e) => [e.key, e.value])).toEqual([
      ["meta", "…"],
      ["date", "2026"],
    ]);
    expect(fm?.entries[1].at).toBe("---\nmeta:\n  inner: x\n".length);
  });

  it("requires the block at position 0", () => {
    expect(frontmatterRange("\n---\ntitle: x\n---\n")).toBeNull();
    expect(frontmatterRange("# Doc\n---\n")).toBeNull();
  });

  it("requires a closing fence on its own line", () => {
    expect(frontmatterRange("---\ntitle: x\n")).toBeNull();
    expect(frontmatterRange("---\ntitle: x\n---xyz\n")).toBeNull();
  });

  it("accepts a closing fence at end of file", () => {
    expect(frontmatterRange("---\ntitle: x\n---")).not.toBeNull();
  });

  it("swallows blank lines but keeps the final separator newline", () => {
    const doc = "---\ntitle: x\n---\n\n\n# Doc\n";
    expect(frontmatterRange(doc)?.to).toBe(doc.indexOf("# Doc") - 1);
    const tight = "---\ntitle: x\n---\n# Doc\n";
    expect(frontmatterRange(tight)?.to).toBe(tight.indexOf("# Doc") - 1);
  });
});
