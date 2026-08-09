import { describe, expect, it } from "vite-plus/test";
import { calloutType } from "./callouts.ts";

describe("calloutType", () => {
  it("recognizes GitHub's five, marker alone on the line", () => {
    expect(calloutType("[!NOTE]")).toBe("note");
    expect(calloutType("[!TIP]")).toBe("tip");
    expect(calloutType("[!IMPORTANT]")).toBe("important");
    expect(calloutType("[!WARNING] ")).toBe("warning");
    expect(calloutType("[!CAUTION]")).toBe("caution");
  });

  it("rejects other markers and trailing content", () => {
    expect(calloutType("[!DANGER]")).toBeNull();
    expect(calloutType("[!NOTE] with text after")).toBeNull();
    expect(calloutType("plain quote")).toBeNull();
  });
});
