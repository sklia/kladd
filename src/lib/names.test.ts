import { describe, expect, it } from "vite-plus/test";
import { validateName } from "./names.ts";

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
