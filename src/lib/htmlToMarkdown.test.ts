// @vitest-environment happy-dom
import { describe, expect, it } from "vite-plus/test";
import { htmlToMarkdown } from "./htmlToMarkdown.ts";

describe("htmlToMarkdown", () => {
  it("converts headings, paragraphs, and emphasis", () => {
    expect(htmlToMarkdown("<h2>Title</h2><p>Hello <b>world</b> and <i>friends</i></p>")).toBe(
      "## Title\n\nHello **world** and _friends_",
    );
  });

  it("converts links, inline code, and strikethrough", () => {
    expect(
      htmlToMarkdown('<p><a href="https://x.dev">x</a> <code>npm i</code> <s>old</s></p>'),
    ).toBe("[x](https://x.dev) `npm i` ~~old~~");
  });

  it("converts a fenced code block from pre > code", () => {
    expect(htmlToMarkdown("<pre><code>const a = 1;\nconst b = 2;</code></pre>")).toBe(
      "```\nconst a = 1;\nconst b = 2;\n```",
    );
  });

  it("converts nested unordered lists", () => {
    expect(htmlToMarkdown("<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>")).toBe(
      "- one\n  - nested\n- two",
    );
  });

  it("converts ordered lists", () => {
    expect(htmlToMarkdown("<ol><li>first</li><li>second</li></ol>")).toBe("1. first\n2. second");
  });

  it("converts blockquotes", () => {
    expect(htmlToMarkdown("<blockquote><p>quoted text</p></blockquote>")).toBe("> quoted text");
  });

  it("converts images", () => {
    expect(htmlToMarkdown('<img src="https://x.dev/a.png" alt="a">')).toBe(
      "![a](https://x.dev/a.png)",
    );
  });

  it("unwraps generic div/span wrappers instead of dropping their content", () => {
    expect(htmlToMarkdown("<div><span>plain</span> <b>bold</b></div>")).toBe("plain **bold**");
  });

  it("keeps emphasis delimiters tight against the text, not the whitespace", () => {
    expect(htmlToMarkdown("<p>Hello<b> world</b></p>")).toBe("Hello **world**");
  });

  it("falls back to space-joined cell text for tables", () => {
    expect(
      htmlToMarkdown("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>"),
    ).toBe("a | b\nc | d");
  });
});
