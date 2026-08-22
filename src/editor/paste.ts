import { invoke } from "@tauri-apps/api/core";
import { EditorView } from "@codemirror/view";
import { htmlToMarkdown } from "../lib/htmlToMarkdown.ts";
import { parentDir } from "../lib/tree.ts";
import { activeEditor } from "./stateCache.ts";

export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/.test(text);
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function imageExtension(mime: string): string {
  return IMAGE_EXTENSIONS[mime] ?? "png";
}

async function pasteImage(file: File, path: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${imageExtension(file.type)}`;
  const dest = `${parentDir(path)}/assets/${name}`;
  try {
    await invoke("write_binary_file", { path: dest, data: Array.from(bytes) });
  } catch (e) {
    console.error(`paste image failed for ${dest}:`, e);
    return;
  }
  // The write is async; by the time it resolves the user may have switched
  // tabs, so re-check against the live active editor before inserting.
  const active = activeEditor();
  if (active?.path !== path) return;
  active.view.dispatch(active.view.state.replaceSelection(`![](assets/${name})`));
}

/** Image paste writes to `<file's dir>/assets/` and inserts a link. A URL
 * pasted over a selection wraps the selected text as a link. HTML paste
 * converts to markdown. Anything else falls through to CodeMirror's normal
 * plain-text paste. Checked in this order: a URL-over-selection paste often
 * also carries `text/html` (e.g. copying a link from a web page), and that
 * must not steal the selection's own text as the link label. */
export function pasteHandler(path: string) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const data = event.clipboardData;
      if (!data) return false;

      const image = [...data.files].find((f) => f.type.startsWith("image/"));
      if (image) {
        event.preventDefault();
        void pasteImage(image, path);
        return true;
      }

      const selection = view.state.selection.main;
      const text = data.getData("text/plain").trim();
      if (!selection.empty && isUrl(text)) {
        const label = view.state.sliceDoc(selection.from, selection.to);
        view.dispatch(view.state.replaceSelection(`[${label}](${text})`));
        return true;
      }

      const html = data.getData("text/html");
      if (html.trim()) {
        const markdown = htmlToMarkdown(html);
        if (markdown) {
          view.dispatch(view.state.replaceSelection(markdown));
          return true;
        }
      }

      return false;
    },
  });
}
