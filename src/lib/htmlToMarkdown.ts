/** Pasted-HTML → markdown, using the browser's native DOMParser. Covers the
 * common paste sources (web pages, Word/Google Docs, GitHub): headings,
 * emphasis, links, inline/fenced code, nested lists, blockquotes,
 * strikethrough, images. Unrecognized wrapper tags (div, span, ...) are
 * unwrapped, not dropped, so Word/Google Docs markup degrades gracefully.
 * ponytail: <table> falls back to space-joined cell text rather than GFM
 * table markdown; upgrade if pasted tables turn out to be common. */
export function htmlToMarkdown(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return blocksOf(body, 0).join("\n\n").trim();
}

const WRAPPERS = new Set(["div", "section", "article"]);

// Text and inline elements (b, span, img, ...) accumulate into `buffer` as
// one running paragraph; only a real block element flushes it. Otherwise
// "<div><span>plain</span> <b>bold</b></div>" would split into two blocks
// instead of stitching into one paragraph, since span/b aren't block-level.
function blocksOf(node: Node, depth: number): string[] {
  const out: string[] = [];
  let buffer = "";
  const flush = () => {
    const text = buffer.replace(/\s+/g, " ").trim();
    if (text) out.push(text);
    buffer = "";
  };
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      buffer += child.textContent ?? "";
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    const heading = /^h([1-6])$/.exec(tag);
    if (heading) {
      flush();
      out.push(`${"#".repeat(Number(heading[1]))} ${inline(el).trim()}`);
    } else if (tag === "p") {
      flush();
      const text = inline(el).trim();
      if (text) out.push(text);
    } else if (tag === "blockquote") {
      flush();
      const quoted = blocksOf(el, depth).join("\n\n");
      out.push(
        quoted
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n"),
      );
    } else if (tag === "pre") {
      flush();
      const code = el.querySelector("code") ?? el;
      out.push(`\`\`\`\n${code.textContent ?? ""}\n\`\`\``);
    } else if (tag === "ul" || tag === "ol") {
      flush();
      out.push(listBlock(el, tag === "ol", depth));
    } else if (tag === "table") {
      flush();
      out.push(tableFallback(el));
    } else if (WRAPPERS.has(tag)) {
      flush();
      out.push(...blocksOf(el, depth));
    } else {
      buffer += inline(el);
    }
  }
  flush();
  return out.filter((s) => s.length > 0);
}

function listBlock(list: Element, ordered: boolean, depth: number): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  let index = 1;
  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== "li") continue;
    const nested = Array.from(li.children).filter((c) =>
      ["ul", "ol"].includes(c.tagName.toLowerCase()),
    );
    const ownText = Array.from(li.childNodes)
      .filter((c) => !nested.includes(c as Element))
      .map(inline)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const marker = ordered ? `${index++}.` : "-";
    lines.push(`${indent}${marker} ${ownText}`);
    for (const sub of nested) {
      lines.push(listBlock(sub as Element, sub.tagName.toLowerCase() === "ol", depth + 1));
    }
  }
  return lines.join("\n");
}

function tableFallback(table: Element): string {
  return Array.from(table.querySelectorAll("tr"))
    .map((tr) =>
      Array.from(tr.querySelectorAll("td, th"))
        .map((cell) => (cell.textContent ?? "").trim())
        .join(" | "),
    )
    .join("\n");
}

/** Moves leading/trailing whitespace outside the delimiters: CommonMark
 * doesn't treat `** text**` as emphasis, only `**text**`. */
function wrapInline(text: string, mark: string): string {
  const leading = /^\s*/.exec(text)?.[0] ?? "";
  const trailing = /\s*$/.exec(text)?.[0] ?? "";
  const core = text.slice(leading.length, text.length - trailing.length);
  return core ? `${leading}${mark}${core}${mark}${trailing}` : text;
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const inner = () => Array.from(el.childNodes).map(inline).join("");
  switch (el.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return wrapInline(inner(), "**");
    case "em":
    case "i":
      return wrapInline(inner(), "_");
    case "del":
    case "s":
    case "strike":
      return wrapInline(inner(), "~~");
    case "code":
      return wrapInline(el.textContent ?? "", "`");
    case "a": {
      const href = el.getAttribute("href");
      return href ? `[${inner()}](${href})` : inner();
    }
    case "img": {
      const src = el.getAttribute("src");
      return src ? `![${el.getAttribute("alt") ?? ""}](${src})` : "";
    }
    case "br":
      return "\n";
    default:
      return inner();
  }
}
