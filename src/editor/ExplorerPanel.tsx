import { useEffect, useState } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";

interface ExplorerPanelProps {
  rootPath: string;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
}

interface ExplorerEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "txt"]);

function isMarkdownFile(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension ? MARKDOWN_EXTENSIONS.has(extension) : false;
}

async function loadEntries(path: string) {
  const entries = await readDir(path);
  const resolved = await Promise.all(
    entries.map(async (entry): Promise<ExplorerEntry> => ({
      name: entry.name,
      path: await join(path, entry.name),
      isDirectory: entry.isDirectory,
    })),
  );
  return resolved.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory)
      return left.isDirectory ? -1 : 1;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function ExplorerNode({
  entry,
  depth,
  onOpenFile,
  onError,
}: {
  entry: ExplorerEntry;
  depth: number;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<ExplorerEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const markdown = !entry.isDirectory && isMarkdownFile(entry.name);

  const toggleDirectory = async () => {
    if (!entry.isDirectory) return;
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children) return;
    setLoading(true);
    try {
      setChildren(await loadEntries(entry.path));
    } catch (error) {
      setExpanded(false);
      onError(`无法读取目录：${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`explorer-entry ${markdown ? "markdown-file" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        title={entry.path}
        disabled={!entry.isDirectory && !markdown}
        onClick={() =>
          entry.isDirectory ? void toggleDirectory() : onOpenFile(entry.path)
        }
      >
        <span className="explorer-chevron" aria-hidden="true">
          {entry.isDirectory ? (
            expanded ? (
              <ChevronDown />
            ) : (
              <ChevronRight />
            )
          ) : null}
        </span>
        {entry.isDirectory ? (
          expanded ? (
            <FolderOpen />
          ) : (
            <Folder />
          )
        ) : markdown ? (
          <FileText />
        ) : (
          <File />
        )}
        <span>{entry.name}</span>
      </button>
      {entry.isDirectory && expanded && (
        <div role="group">
          {loading ? (
            <div
              className="explorer-message"
              style={{ paddingLeft: 30 + depth * 14 }}
            >
              正在读取…
            </div>
          ) : children?.length ? (
            children.map((child) => (
              <ExplorerNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onError={onError}
              />
            ))
          ) : (
            <div
              className="explorer-message"
              style={{ paddingLeft: 30 + depth * 14 }}
            >
              空目录
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ExplorerPanel({
  rootPath,
  onOpenFile,
  onError,
}: ExplorerPanelProps) {
  const [entries, setEntries] = useState<ExplorerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadEntries(rootPath)
      .then((nextEntries) => {
        if (!cancelled) setEntries(nextEntries);
      })
      .catch((error) => {
        if (!cancelled) onError(`无法读取目录：${String(error)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError, rootPath]);

  const rootName = rootPath.split(/[\\/]/).filter(Boolean).pop() ?? rootPath;

  return (
    <aside className="explorer-panel" aria-label="资源管理器">
      <div className="explorer-header" title={rootPath}>
        资源管理器
      </div>
      <div className="explorer-root-name" title={rootPath}>
        {rootName}
      </div>
      <div className="explorer-tree" role="tree">
        {loading ? (
          <div className="explorer-message">正在读取目录…</div>
        ) : entries.length ? (
          entries.map((entry) => (
            <ExplorerNode
              key={entry.path}
              entry={entry}
              depth={0}
              onOpenFile={onOpenFile}
              onError={onError}
            />
          ))
        ) : (
          <div className="explorer-message">空目录</div>
        )}
      </div>
    </aside>
  );
}
