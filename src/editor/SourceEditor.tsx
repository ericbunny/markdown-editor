import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { basicSetup } from "codemirror";
import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { EditorHandle } from "./EditorHandle";

interface SourceEditorProps {
  initialMarkdown: string;
  dark: boolean;
  onChange: (markdown: string) => void;
}

export const SourceEditor = forwardRef<EditorHandle, SourceEditorProps>(
  function SourceEditor({ initialMarkdown, dark, onChange }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);

    useImperativeHandle(ref, () => ({
      getMarkdown: () =>
        viewRef.current?.state.doc.toString() ?? initialMarkdown,
      undo: () => {
        if (viewRef.current) undo(viewRef.current);
      },
      redo: () => {
        if (viewRef.current) redo(viewRef.current);
      },
    }));

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      if (!rootRef.current) return;

      const state = EditorState.create({
        doc: initialMarkdown,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          // 颜色统一走 App.css 里的设计令牌，深浅色只切换变量；
          // 这里的 { dark } 只是告诉 CodeMirror 当前处于深色主题。
          EditorView.theme(
            {
              "&": {
                color: "var(--text)",
                backgroundColor: "var(--editor-background)",
              },
              ".cm-gutters": {
                color: "var(--muted)",
                backgroundColor: "var(--editor-background)",
                border: "none",
              },
              ".cm-activeLine, .cm-activeLineGutter": {
                backgroundColor: "var(--active-line)",
              },
              "&.cm-focused .cm-cursor": {
                borderLeftColor: "var(--text)",
              },
            },
            { dark },
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              onChangeRef.current(update.state.doc.toString());
          }),
        ],
      });

      const view = new EditorView({ state, parent: rootRef.current });
      viewRef.current = view;
      return () => {
        viewRef.current = null;
        view.destroy();
      };
    }, [dark]);

    return <div ref={rootRef} className="source-editor" />;
  },
);
