import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { livePreview } from "./editor/livePreview.ts";
import "./editor/theme.css";

export function Editor({ initialDoc }: { initialDoc: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const view = new EditorView({
      doc: initialDoc,
      parent: host.current!,
      extensions: [
        minimalSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        livePreview,
      ],
    });
    view.focus();
    return () => view.destroy();
  }, [initialDoc]);

  return <div className="editor-host" ref={host} />;
}
