import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { scheduleSave, syncAnnotation } from "../store/sync.ts";
import { frontmatter, frontmatterRange } from "./frontmatter.ts";
import { livePreview } from "./livePreview.ts";
import { pasteHandler } from "./paste.ts";
import { renderMode, toggleRawMode } from "./rawMode.ts";
import { cachedEditorState, cacheEditorState, setActiveEditor } from "./stateCache.ts";
import { tables } from "./tables.ts";
import "./theme.css";

const rendered = [livePreview, frontmatter, tables];

/** First open: caret at the start of content. A brand-new note ("# ")
 * gets it after the hash so the heading is the first thing typed; files
 * with frontmatter start below it, never against the collapsed block. */
function openingAnchor(doc: string): number {
  if (doc === "# ") return doc.length;
  const fm = frontmatterRange(doc.slice(0, 4096));
  return fm === null ? 0 : Math.min(fm.to + 1, doc.length);
}

function freshState(path: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: openingAnchor(doc) },
    extensions: [
      minimalSetup,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      renderMode.of(rendered),
      pasteHandler(path),
      search({ top: true }),
      keymap.of([...searchKeymap, { key: "Mod-e", run: (v) => toggleRawMode(v, rendered) }]),
      // Autosave: user edits schedule a debounced save; reloads from disk
      // (marked with syncAnnotation) must not save what we just read.
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((tr) => tr.annotation(syncAnnotation) === true)
        ) {
          scheduleSave(path);
        }
      }),
    ],
  });
}

export function Editor({ path, initialDoc }: { path: string; initialDoc: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const shownPath = useRef<string | null>(null);

  useEffect(() => {
    const v = new EditorView({ parent: host.current! });
    view.current = v;
    return () => {
      if (shownPath.current !== null) cacheEditorState(shownPath.current, v.state);
      setActiveEditor(null, null);
      shownPath.current = null;
      view.current = null;
      v.destroy();
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v === null || shownPath.current === path) return;
    if (shownPath.current !== null) cacheEditorState(shownPath.current, v.state);
    shownPath.current = path;
    v.setState(cachedEditorState(path) ?? freshState(path, initialDoc));
    setActiveEditor(path, v);
    v.focus();
  }, [path, initialDoc]);

  return <div className="editor-host" ref={host} />;
}
