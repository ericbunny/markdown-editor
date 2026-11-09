export interface EditorHandle {
  getMarkdown: () => string;
  undo: () => void;
  redo: () => void;
}
