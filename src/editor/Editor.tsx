import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { livePreview } from "./livePreview.ts";
import { cachedEditorState, cacheEditorState } from "./stateCache.ts";
import "./theme.css";

function freshState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      minimalSetup,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      livePreview,
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
    v.setState(cachedEditorState(path) ?? freshState(initialDoc));
    v.focus();
  }, [path, initialDoc]);

  return <div className="editor-host" ref={host} />;
}
