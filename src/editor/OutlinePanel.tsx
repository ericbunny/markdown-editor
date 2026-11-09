export interface OutlineItem {
  level: number;
  text: string;
  headingIndex: number;
}

function plainHeadingText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

export function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: OutlineItem[] = [];
  let fence: "`" | "~" | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence) continue;

    const atx = line.match(/^ {0,3}(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$/);
    if (atx) {
      const text = plainHeadingText(atx[2]);
      if (text) {
        items.push({
          level: atx[1].length,
          text,
          headingIndex: items.length,
        });
      }
      continue;
    }

    const underline = lines[index + 1]?.match(/^ {0,3}(=+|-+)[\t ]*$/);
    if (line.trim() && underline) {
      const text = plainHeadingText(line);
      if (text) {
        items.push({
          level: underline[1][0] === "=" ? 1 : 2,
          text,
          headingIndex: items.length,
        });
      }
      index += 1;
    }
  }

  return items;
}

interface OutlinePanelProps {
  items: OutlineItem[];
  onSelect: (item: OutlineItem) => void;
}

export function OutlinePanel({ items, onSelect }: OutlinePanelProps) {
  return (
    <aside className="outline-panel" aria-label="文档大纲">
      <div className="outline-header">大纲</div>
      {items.length > 0 ? (
        <nav className="outline-list" aria-label="标题列表">
          {items.map((item) => (
            <button
              key={`${item.headingIndex}-${item.text}`}
              type="button"
              className={`outline-item outline-level-${item.level}`}
              title={item.text}
              onClick={() => onSelect(item)}
            >
              {item.text}
            </button>
          ))}
        </nav>
      ) : (
        <p className="outline-empty">文档中暂无标题</p>
      )}
    </aside>
  );
}
