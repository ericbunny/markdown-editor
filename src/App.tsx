import {
  CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
  Code2,
  FilePlus2,
  FileText,
  FileInput,
  FolderOpen,
  FolderTree,
  ListTree,
  Moon,
  Network,
  Redo2,
  Save,
  Settings,
  Sun,
  Undo2,
  X,
} from "lucide-react";
import { SourceEditor } from "./editor/SourceEditor";
import { EditorHandle } from "./editor/EditorHandle";
import { ExplorerPanel } from "./editor/ExplorerPanel";
import {
  DEFAULT_SETTINGS,
  EditorSettings,
  SettingsPanel,
} from "./editor/SettingsPanel";
import {
  extractOutline,
  OutlineItem,
  OutlinePanel,
} from "./editor/OutlinePanel";
import { VisualEditor } from "./editor/VisualEditor";
import "./App.css";

const MarkmapPanel = lazy(() =>
  import("./editor/MarkmapPanel").then((module) => ({
    default: module.MarkmapPanel,
  })),
);

type EditorMode = "visual" | "source";
interface DocumentTab {
  id: number;
  name: string;
  path: string | null;
  sourcePath: string | null;
  markdown: string;
  savedMarkdown: string | null;
}

const SETTINGS_KEY = "markdown-editor.settings";
const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "txt"];
const IMPORT_EXTENSIONS = [
  "doc",
  "docx",
  "docm",
  "odt",
  "rtf",
  "epub",
  "pdf",
  "ppt",
  "pps",
  "pot",
  "pptx",
  "pptm",
  "ppsx",
  "ppsm",
  "odp",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ods",
  "csv",
];
let nextDocumentId = 1;

function createDocument(
  markdown = "",
  path: string | null = null,
  name = fileName(path),
  sourcePath: string | null = null,
  savedMarkdown: string | null = markdown,
): DocumentTab {
  return {
    id: nextDocumentId++,
    name,
    path,
    sourcePath,
    markdown,
    savedMarkdown,
  };
}

function loadSettings(): EditorSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<EditorSettings>;
    // 将上一版的默认行高迁移到新的紧凑默认值，用户设置的其他值保持不变。
    if (parsed.lineHeight === 1.75)
      parsed.lineHeight = DEFAULT_SETTINGS.lineHeight;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function fileName(path: string | null) {
  if (!path) return "未命名.md";
  return path.split(/[\\/]/).pop() ?? path;
}

function importedFileName(path: string) {
  return fileName(path).replace(/\.[^.]+$/, "") + ".md";
}

function App() {
  const editorRef = useRef<EditorHandle>(null);
  const [documents, setDocuments] = useState<DocumentTab[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>(
    () => loadSettings().defaultMode,
  );
  const [dark, setDark] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [status, setStatus] = useState("就绪");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [markmapOpen, setMarkmapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>(loadSettings);

  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId,
  );
  const markdown = activeDocument?.markdown ?? "";
  const name = activeDocument?.name ?? "Markdown 编辑器";
  const path = activeDocument?.path ?? null;
  const dirty = activeDocument
    ? markdown !== activeDocument.savedMarkdown
    : false;
  const hasUnsavedDocuments = documents.some(
    (document) => document.markdown !== document.savedMarkdown,
  );
  const title = useMemo(
    () => `${dirty ? "● " : ""}${name} - Markdown Editor`,
    [dirty, name],
  );
  const outlineItems = useMemo(() => extractOutline(markdown), [markdown]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (!hasUnsavedDocuments) return;
    const confirmClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmClose);
    return () => window.removeEventListener("beforeunload", confirmClose);
  }, [hasUnsavedDocuments]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  const updateDocument = useCallback(
    (id: number, patch: Partial<Omit<DocumentTab, "id">>) => {
      setDocuments((current) =>
        current.map((document) =>
          document.id === id ? { ...document, ...patch } : document,
        ),
      );
    },
    [],
  );

  const syncActiveDocument = useCallback(() => {
    if (activeDocumentId === null) return "";
    const currentMarkdown = editorRef.current?.getMarkdown();
    if (currentMarkdown !== undefined)
      updateDocument(activeDocumentId, { markdown: currentMarkdown });
    return currentMarkdown ?? markdown;
  }, [activeDocumentId, markdown, updateDocument]);

  const newDocument = useCallback(() => {
    syncActiveDocument();
    const document = createDocument();
    setDocuments((current) => [...current, document]);
    setActiveDocumentId(document.id);
    setEditorRevision((revision) => revision + 1);
    setStatus("已新建文档");
  }, [syncActiveDocument]);

  const openDocument = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Markdown", extensions: MARKDOWN_EXTENSIONS }],
    });
    if (!selected) return;

    const selectedPaths = Array.isArray(selected) ? selected : [selected];
    syncActiveDocument();

    try {
      const openedDocuments: DocumentTab[] = [];
      for (const selectedPath of selectedPaths) {
        const existing = documents.find(
          (document) =>
            document.path === selectedPath ||
            document.sourcePath === selectedPath,
        );
        if (existing) {
          openedDocuments.push(existing);
          continue;
        }
        const contents = await readTextFile(selectedPath);
        openedDocuments.push(createDocument(contents, selectedPath));
      }
      const newDocuments = openedDocuments.filter(
        (opened) => !documents.some((document) => document.id === opened.id),
      );
      setDocuments((current) => [...current, ...newDocuments]);
      setActiveDocumentId(openedDocuments[openedDocuments.length - 1].id);
      setEditorRevision((revision) => revision + 1);
      setStatus(`已打开 ${openedDocuments.length} 个文档`);
    } catch (error) {
      setStatus(`打开失败：${String(error)}`);
    }
  }, [documents, syncActiveDocument]);

  const openDirectory = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    setWorkspacePath(selected);
    setExplorerOpen(true);
    setOutlineOpen(false);
    setStatus(`已打开目录 ${fileName(selected)}`);
  }, []);

  const openWorkspaceFile = useCallback(
    async (selectedPath: string) => {
      syncActiveDocument();
      const existing = documents.find(
        (document) =>
          document.path === selectedPath ||
          document.sourcePath === selectedPath,
      );
      if (existing) {
        setActiveDocumentId(existing.id);
        setEditorRevision((revision) => revision + 1);
        return;
      }
      try {
        const contents = await readTextFile(selectedPath);
        const document = createDocument(contents, selectedPath);
        setDocuments((current) => [...current, document]);
        setActiveDocumentId(document.id);
        setEditorRevision((revision) => revision + 1);
        setStatus(`已打开 ${document.name}`);
      } catch (error) {
        setStatus(`打开失败：${String(error)}`);
      }
    },
    [documents, syncActiveDocument],
  );

  const importDocument = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "可导入的文档", extensions: IMPORT_EXTENSIONS }],
    });
    if (!selected) return;

    const selectedPaths = Array.isArray(selected) ? selected : [selected];
    syncActiveDocument();

    try {
      const importedDocuments: DocumentTab[] = [];
      for (const selectedPath of selectedPaths) {
        const existing = documents.find(
          (document) => document.sourcePath === selectedPath,
        );
        if (existing) {
          importedDocuments.push(existing);
          continue;
        }
        const contents = await invoke<string>("convert_document_to_markdown", {
          path: selectedPath,
        });
        importedDocuments.push(
          createDocument(
            contents,
            null,
            importedFileName(selectedPath),
            selectedPath,
            null,
          ),
        );
      }
      const newDocuments = importedDocuments.filter(
        (imported) =>
          !documents.some((document) => document.id === imported.id),
      );
      setDocuments((current) => [...current, ...newDocuments]);
      setActiveDocumentId(importedDocuments[importedDocuments.length - 1].id);
      setEditorRevision((revision) => revision + 1);
      setStatus(`已导入 ${importedDocuments.length} 个文档`);
    } catch (error) {
      setStatus(`导入失败：${String(error)}`);
    }
  }, [documents, syncActiveDocument]);

  const saveDocument = useCallback(
    async (saveAs = false) => {
      if (activeDocumentId === null) return;
      const documentId = activeDocumentId;
      let target = saveAs ? null : path;
      if (!target) {
        target = await save({
          defaultPath: name,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
      }
      if (!target) return;

      try {
        const currentMarkdown = syncActiveDocument();
        await writeTextFile(target, currentMarkdown);
        updateDocument(documentId, {
          name: fileName(target),
          path: target,
          markdown: currentMarkdown,
          savedMarkdown: currentMarkdown,
        });
        setStatus(`已保存 ${fileName(target)}`);
      } catch (error) {
        setStatus(`保存失败：${String(error)}`);
      }
    },
    [activeDocumentId, name, path, syncActiveDocument, updateDocument],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDocument(event.shiftKey);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (event.shiftKey) void importDocument();
        else void openDocument();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [importDocument, newDocument, openDocument, saveDocument]);

  const switchMode = () => {
    syncActiveDocument();
    setMarkmapOpen(false);
    setMode((current) => (current === "visual" ? "source" : "visual"));
    setEditorRevision((revision) => revision + 1);
  };

  const selectDocument = (id: number) => {
    if (id === activeDocumentId) return;
    syncActiveDocument();
    setActiveDocumentId(id);
    setEditorRevision((revision) => revision + 1);
  };

  const closeDocument = (id: number) => {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const currentMarkdown =
      id === activeDocumentId ? syncActiveDocument() : document.markdown;
    if (
      currentMarkdown !== document.savedMarkdown &&
      !window.confirm(`“${document.name}”尚未保存，确定关闭吗？`)
    )
      return;

    const index = documents.findIndex((item) => item.id === id);
    const remaining = documents.filter((item) => item.id !== id);
    setDocuments(remaining);
    if (id === activeDocumentId) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      setActiveDocumentId(next?.id ?? null);
    }
    setEditorRevision((revision) => revision + 1);
  };

  const changeActiveMarkdown = useCallback(
    (nextMarkdown: string) => {
      if (activeDocumentId === null) return;
      updateDocument(activeDocumentId, { markdown: nextMarkdown });
    },
    [activeDocumentId, updateDocument],
  );

  const updateSettings = (next: EditorSettings) => {
    if (next.defaultMode !== settings.defaultMode) {
      syncActiveDocument();
      setMode(next.defaultMode);
      setEditorRevision((revision) => revision + 1);
    }
    setSettings(next);
  };

  const selectOutlineItem = (item: OutlineItem) => {
    setMarkmapOpen(false);
    if (mode !== "visual") {
      setMode("visual");
      setEditorRevision((revision) => revision + 1);
    }

    window.setTimeout(
      () => {
        const headings = document.querySelectorAll<HTMLElement>(
          ".visual-editor .ProseMirror h1, .visual-editor .ProseMirror h2, .visual-editor .ProseMirror h3, .visual-editor .ProseMirror h4, .visual-editor .ProseMirror h5, .visual-editor .ProseMirror h6",
        );
        headings[item.headingIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
      mode === "visual" ? 0 : 120,
    );
  };

  const fontFamily = {
    default: "var(--font-ui)",
    serif: 'Georgia, "Times New Roman", "Microsoft YaHei", serif',
    mono: "var(--font-mono)",
  }[settings.fontFamily];
  const sourceFont = {
    default: "var(--font-mono)",
    cascadia: '"Cascadia Code", Consolas, monospace',
    jetbrains: '"JetBrains Mono", Consolas, monospace',
  }[settings.sourceFont];
  const boldColor = {
    default: "var(--text)",
    accent: "var(--accent)",
    red: "#d64545",
  }[settings.boldColor];
  const appStyle = {
    "--ui-font-size": `${settings.uiFontSize}px`,
    "--editor-font-size": `${settings.editorFontSize}px`,
    "--editor-font-family": fontFamily,
    "--editor-background": settings.backgroundColor ?? "var(--surface)",
    "--editor-line-height": settings.lineHeight,
    "--editor-page-width": settings.pageWidth,
    "--editor-bold-color": boldColor,
    "--source-font-family": sourceFont,
    "--source-max-height": settings.sourceMaxHeight,
    "--image-max-width": `${settings.imageMaxWidth}%`,
  } as CSSProperties;

  return (
    <main
      className={`${dark ? "app app-dark" : "app"}${settings.typewriterMode ? " typewriter-mode" : ""}`}
      style={appStyle}
    >
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <FileText size={16} />
          </span>
          <span className="brand-name">{name}</span>
          {dirty && <span className="dirty-dot" title="有未保存的更改" />}
        </div>

        <nav className="app-actions" aria-label="文档操作">
          <button
            type="button"
            onClick={newDocument}
            title="新建"
            aria-label="新建"
          >
            <FilePlus2 />
          </button>
          <button
            type="button"
            className="action-with-label"
            onClick={() => void openDocument()}
            title="打开 Markdown (Ctrl+O)"
            aria-label="打开 Markdown"
          >
            <FolderOpen />
            <span>打开</span>
          </button>
          <button
            type="button"
            className={`action-with-label ${explorerOpen ? "active" : ""}`}
            onClick={() => void openDirectory()}
            title="打开目录"
            aria-label="打开目录"
            aria-pressed={explorerOpen}
          >
            <FolderTree />
            <span>目录</span>
          </button>
          <button
            type="button"
            className="action-with-label"
            onClick={() => void importDocument()}
            title="导入文档 (Ctrl+Shift+O)"
            aria-label="导入文档"
          >
            <FileInput />
            <span>导入</span>
          </button>
          <button
            type="button"
            onClick={() => void saveDocument()}
            title="保存 (Ctrl+S)"
            aria-label="保存"
            disabled={!activeDocument}
          >
            <Save />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.undo()}
            title="撤销 (Ctrl+Z)"
            aria-label="撤销"
            disabled={!activeDocument || markmapOpen}
          >
            <Undo2 />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.redo()}
            title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
            aria-label="重做"
            disabled={!activeDocument || markmapOpen}
          >
            <Redo2 />
          </button>
          <span className="toolbar-separator" />
          <button
            type="button"
            className={outlineOpen ? "active" : ""}
            onClick={() => {
              setOutlineOpen((value) => !value);
              setExplorerOpen(false);
            }}
            title={outlineOpen ? "隐藏大纲" : "显示大纲"}
            aria-label={outlineOpen ? "隐藏大纲" : "显示大纲"}
            aria-pressed={outlineOpen}
            disabled={!activeDocument}
          >
            <ListTree />
          </button>
          <button
            type="button"
            className={`action-with-label ${mode === "source" ? "active" : ""}`}
            onClick={switchMode}
            title={mode === "visual" ? "查看 Markdown 源码" : "返回可视化编辑"}
            aria-label={
              mode === "visual" ? "查看 Markdown 源码" : "返回可视化编辑"
            }
            aria-pressed={mode === "source"}
            disabled={!activeDocument}
          >
            <Code2 />
            <span>{mode === "visual" ? "源码" : "预览"}</span>
          </button>
          <button
            type="button"
            className={`action-with-label ${markmapOpen ? "active" : ""}`}
            onClick={() => {
              if (!markmapOpen) syncActiveDocument();
              setMarkmapOpen((value) => !value);
            }}
            title={markmapOpen ? "返回编辑器" : "查看 Markmap 思维导图"}
            aria-label={markmapOpen ? "返回编辑器" : "查看 Markmap 思维导图"}
            aria-pressed={markmapOpen}
            disabled={!activeDocument}
          >
            <Network />
            <span>{markmapOpen ? "编辑" : "导图"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            title="切换主题"
            aria-label="切换主题"
            aria-pressed={dark}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <button
            type="button"
            className={settingsOpen ? "active" : ""}
            title="编辑器设置"
            aria-label="编辑器设置"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <Settings />
          </button>
        </nav>
      </header>

      <div className="document-tabs" role="tablist" aria-label="打开的文档">
        {documents.map((document) => {
          const isActive = document.id === activeDocumentId;
          const isDirty = document.markdown !== document.savedMarkdown;
          return (
            <div
              key={document.id}
              className={`document-tab ${isActive ? "active" : ""}`}
              role="tab"
              aria-selected={isActive}
            >
              <button
                type="button"
                className="document-tab-select"
                title={document.path ?? document.sourcePath ?? document.name}
                onClick={() => selectDocument(document.id)}
              >
                <FileText />
                <span>{document.name}</span>
                {isDirty && <i title="有未保存的更改" />}
              </button>
              <button
                type="button"
                className="document-tab-close"
                title="关闭"
                aria-label={`关闭 ${document.name}`}
                onClick={() => closeDocument(document.id)}
              >
                <X />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className={`workspace ${(explorerOpen && workspacePath) || (activeDocument && outlineOpen && !markmapOpen) ? "sidebar-visible" : ""}`}
      >
        {explorerOpen && workspacePath && (
          <ExplorerPanel
            rootPath={workspacePath}
            onOpenFile={(selectedPath) => void openWorkspaceFile(selectedPath)}
            onError={setStatus}
          />
        )}
        {activeDocument && outlineOpen && !markmapOpen && (
          <OutlinePanel items={outlineItems} onSelect={selectOutlineItem} />
        )}
        <section className="editor-shell">
          {!activeDocument ? (
            <div className="empty-workspace">
              <FileText aria-hidden="true" />
              <p>尚未打开文档</p>
              <span>新建文档，或打开、导入已有文件</span>
            </div>
          ) : markmapOpen ? (
            <Suspense
              fallback={<div className="markmap-loading">正在生成导图…</div>}
            >
              <MarkmapPanel markdown={markdown} />
            </Suspense>
          ) : mode === "visual" ? (
            <VisualEditor
              ref={editorRef}
              key={`visual-${activeDocumentId}-${editorRevision}`}
              initialMarkdown={markdown}
              dark={dark}
              onChange={changeActiveMarkdown}
            />
          ) : (
            <SourceEditor
              ref={editorRef}
              key={`source-${activeDocumentId}-${editorRevision}`}
              initialMarkdown={markdown}
              dark={dark}
              onChange={changeActiveMarkdown}
            />
          )}
        </section>
      </div>

      <footer className="status-bar">
        <span className="status-message">{status}</span>
        <span className="status-chip">
          {mode === "visual" ? "可视化模式" : "Markdown 源码模式"}
        </span>
        <span className="status-chip">
          {markdown.length.toLocaleString()} 字符
        </span>
        <button
          type="button"
          onClick={() => void saveDocument(true)}
          disabled={!activeDocument}
        >
          另存为
        </button>
      </footer>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}

export default App;
