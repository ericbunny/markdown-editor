import { Minus, Plus, RotateCcw, X } from "lucide-react";

export interface EditorSettings {
  defaultMode: "visual" | "source";
  uiFontSize: number;
  editorFontSize: number;
  fontFamily: "default" | "serif" | "mono";
  backgroundColor: string | null;
  boldColor: "default" | "accent" | "red";
  pageWidth: "680px" | "760px" | "900px" | "100%";
  lineHeight: number;
  typewriterMode: boolean;
  sourceFont: "default" | "cascadia" | "jetbrains";
  sourceMaxHeight: "100%" | "60vh" | "80vh";
  imageMaxWidth: number;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  defaultMode: "visual",
  uiFontSize: 13,
  editorFontSize: 17,
  fontFamily: "default",
  backgroundColor: null,
  boldColor: "default",
  pageWidth: "760px",
  lineHeight: 1.6,
  typewriterMode: false,
  sourceFont: "default",
  sourceMaxHeight: "100%",
  imageMaxWidth: 100,
};

interface SettingsPanelProps {
  settings: EditorSettings;
  onChange: (settings: EditorSettings) => void;
  onClose: () => void;
}

function Stepper({
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const update = (next: number) => {
    const rounded = Math.round(next * 100) / 100;
    onChange(Math.min(max, Math.max(min, rounded)));
  };
  return (
    <div className="setting-stepper">
      <button
        type="button"
        onClick={() => update(value - step)}
        aria-label="减小"
      >
        <Minus />
      </button>
      <output>
        {value}
        {suffix}
      </output>
      <button
        type="button"
        onClick={() => update(value + step)}
        aria-label="增大"
      >
        <Plus />
      </button>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const patch = <K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="settings-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="编辑器设置"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <div>
            <strong>编辑器设置</strong>
            <span>外观与编辑体验</span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭设置">
            <X />
          </button>
        </header>

        <div className="settings-scroll">
          <section className="settings-section">
            <h2>编辑模式</h2>
            <div className="mode-segment">
              <button
                type="button"
                className={settings.defaultMode === "visual" ? "active" : ""}
                onClick={() => patch("defaultMode", "visual")}
              >
                可视化
              </button>
              <button
                type="button"
                className={settings.defaultMode === "source" ? "active" : ""}
                onClick={() => patch("defaultMode", "source")}
              >
                源码
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h2>字号</h2>
            <div className="settings-card">
              <div className="setting-row">
                <label>界面</label>
                <Stepper
                  value={settings.uiFontSize}
                  suffix="px"
                  min={11}
                  max={18}
                  step={1}
                  onChange={(value) => patch("uiFontSize", value)}
                />
              </div>
              <div className="setting-row">
                <label>编辑器</label>
                <Stepper
                  value={settings.editorFontSize}
                  suffix="px"
                  min={12}
                  max={28}
                  step={1}
                  onChange={(value) => patch("editorFontSize", value)}
                />
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2>排版</h2>
            <div className="settings-card">
              <div className="setting-row">
                <label htmlFor="setting-font">字体</label>
                <select
                  id="setting-font"
                  value={settings.fontFamily}
                  onChange={(event) =>
                    patch(
                      "fontFamily",
                      event.target.value as EditorSettings["fontFamily"],
                    )
                  }
                >
                  <option value="default">默认</option>
                  <option value="serif">衬线字体</option>
                  <option value="mono">等宽字体</option>
                </select>
              </div>
              <div className="setting-row">
                <label htmlFor="setting-bold-color">粗体颜色</label>
                <select
                  id="setting-bold-color"
                  value={settings.boldColor}
                  onChange={(event) =>
                    patch(
                      "boldColor",
                      event.target.value as EditorSettings["boldColor"],
                    )
                  }
                >
                  <option value="default">默认</option>
                  <option value="accent">强调色</option>
                  <option value="red">红色</option>
                </select>
              </div>
              <div className="setting-row">
                <label htmlFor="setting-background-color">背景颜色</label>
                <div className="setting-color">
                  <input
                    id="setting-background-color"
                    type="color"
                    value={settings.backgroundColor ?? "#ffffff"}
                    onChange={(event) =>
                      patch("backgroundColor", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className={settings.backgroundColor ? "" : "active"}
                    onClick={() => patch("backgroundColor", null)}
                    title="跟随主题"
                  >
                    <RotateCcw />
                    <span>默认</span>
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <label htmlFor="setting-page-width">页面宽度</label>
                <select
                  id="setting-page-width"
                  value={settings.pageWidth}
                  onChange={(event) =>
                    patch(
                      "pageWidth",
                      event.target.value as EditorSettings["pageWidth"],
                    )
                  }
                >
                  <option value="680px">紧凑</option>
                  <option value="760px">标准</option>
                  <option value="900px">宽屏</option>
                  <option value="100%">100%</option>
                </select>
              </div>
              <div className="setting-row">
                <label>行高</label>
                <Stepper
                  value={settings.lineHeight}
                  min={1.2}
                  max={2.4}
                  step={0.1}
                  onChange={(value) => patch("lineHeight", value)}
                />
              </div>
              <div className="setting-row">
                <label htmlFor="setting-typewriter">打字机模式</label>
                <input
                  id="setting-typewriter"
                  className="setting-switch"
                  type="checkbox"
                  checked={settings.typewriterMode}
                  onChange={(event) =>
                    patch("typewriterMode", event.target.checked)
                  }
                />
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2>源码编辑器</h2>
            <div className="settings-card">
              <div className="setting-row">
                <label htmlFor="setting-source-font">字体</label>
                <select
                  id="setting-source-font"
                  value={settings.sourceFont}
                  onChange={(event) =>
                    patch(
                      "sourceFont",
                      event.target.value as EditorSettings["sourceFont"],
                    )
                  }
                >
                  <option value="default">默认</option>
                  <option value="cascadia">Cascadia Code</option>
                  <option value="jetbrains">JetBrains Mono</option>
                </select>
              </div>
              <div className="setting-row">
                <label htmlFor="setting-source-height">最大高度</label>
                <select
                  id="setting-source-height"
                  value={settings.sourceMaxHeight}
                  onChange={(event) =>
                    patch(
                      "sourceMaxHeight",
                      event.target.value as EditorSettings["sourceMaxHeight"],
                    )
                  }
                >
                  <option value="100%">默认</option>
                  <option value="60vh">60vh</option>
                  <option value="80vh">80vh</option>
                </select>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2>图片尺寸</h2>
            <div className="settings-card">
              <div className="setting-row">
                <label>最大宽度</label>
                <Stepper
                  value={settings.imageMaxWidth}
                  suffix="%"
                  min={30}
                  max={100}
                  step={10}
                  onChange={(value) => patch("imageMaxWidth", value)}
                />
              </div>
            </div>
          </section>

          <button
            type="button"
            className="settings-reset"
            onClick={() => onChange(DEFAULT_SETTINGS)}
          >
            <RotateCcw />
            恢复默认设置
          </button>
        </div>
      </aside>
    </div>
  );
}
