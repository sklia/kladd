import { describe, expect, it } from "vite-plus/test";
import { githubUrl } from "./githubUrl.ts";

describe("githubUrl", () => {
  it("converts all three GitHub remote forms", () => {
    expect(githubUrl("git@github.com:sklia/kladd.git")).toBe("https://github.com/sklia/kladd");
    expect(githubUrl("https://github.com/sklia/kladd.git")).toBe("https://github.com/sklia/kladd");
    expect(githubUrl("ssh://git@github.com/sklia/kladd.git")).toBe(
      "https://github.com/sklia/kladd",
    );
  });

  it("passes clean https URLs through and strips .git", () => {
    expect(githubUrl("https://github.com/sklia/kladd")).toBe("https://github.com/sklia/kladd");
  });

  it("returns null for other hosts and non-remotes", () => {
    expect(githubUrl("https://gitlab.com/a/b.git")).toBeNull();
    expect(githubUrl("git@gitlab.com:a/b.git")).toBeNull();
    expect(githubUrl("/local/path")).toBeNull();
    expect(githubUrl("")).toBeNull();
  });
});
