import { describe, expect, it } from "vite-plus/test";
import { imageExtension, isUrl } from "./paste.ts";

describe("isUrl", () => {
  it("accepts bare http(s) URLs", () => {
    expect(isUrl("https://kladd.dev")).toBe(true);
    expect(isUrl("http://kladd.dev/path?q=1")).toBe(true);
  });

  it("rejects text that isn't a bare URL", () => {
    expect(isUrl("see https://kladd.dev")).toBe(false);
    expect(isUrl("kladd.dev")).toBe(false);
    expect(isUrl("")).toBe(false);
  });
});

describe("imageExtension", () => {
  it("maps known image mime types to their extension", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg")).toBe("jpg");
  });

  it("falls back to png for unknown types", () => {
    expect(imageExtension("image/bmp")).toBe("png");
  });
});
