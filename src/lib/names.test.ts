import { describe, expect, it } from "vite-plus/test";
import { ensureMd, stripExt, validateName } from "./names.ts";

describe("stripExt", () => {
  it("removes the extension but keeps dotless names and leading dots", () => {
    expect(stripExt("implementation-plan.md")).toBe("implementation-plan");
    expect(stripExt("notes")).toBe("notes");
    expect(stripExt("v1.2-notes.md")).toBe("v1.2-notes");
  });
});

describe("ensureMd", () => {
  it("appends .md only when missing, case-insensitively", () => {
    expect(ensureMd("ideas")).toBe("ideas.md");
    expect(ensureMd("ideas.md")).toBe("ideas.md");
    expect(ensureMd("IDEAS.MD")).toBe("IDEAS.MD");
  });
});

describe("validateName", () => {
  it("accepts a normal name", () => {
    expect(validateName("notes.md", ["other.md"])).toBeNull();
  });

  it("rejects empty and whitespace", () => {
    expect(validateName("  ", [])).not.toBeNull();
  });

  it("rejects path separators and leading dots", () => {
    expect(validateName("a/b.md", [])).not.toBeNull();
    expect(validateName(".hidden", [])).not.toBeNull();
  });

  it("rejects duplicates case-insensitively", () => {
    expect(validateName("Notes.md", ["notes.md"])).toBe("Already exists");
  });
});
