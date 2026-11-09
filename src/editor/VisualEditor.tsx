import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { redoCommand, undoCommand } from "@milkdown/plugin-history";
import { callCommand } from "@milkdown/utils";
import { EditorHandle } from "./EditorHandle";
import {
  applyTextBackground,
  applyTextColor,
  configureTextColor,
} from "./textColor";
// 只引浅色基础主题：深色令牌由 App.css 里 .visual-editor .milkdown 的变量映射
// 跟随 .app-dark 的令牌自动切换。frame.css 与 frame-dark.css 都只定义
// .milkdown 变量，同时引入会让后加载的 frame-dark 恒生效。
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

const TOP_BAR_TOOLTIPS = [
  "加粗 (Ctrl+B)",
  "斜体 (Ctrl+I)",
  "删除线",
  "行内代码",
  "无序列表",
  "有序列表",
  "任务列表",
  "插入链接",
  "插入图片",
  "插入表格",
  "代码块",
  "数学公式",
  "引用",
  "分隔线",
] as const;

const THEME_COLORS = [
  "#000000",
  "#374151",
  "#64748b",
  "#2563eb",
  "#0ea5e9",
  "#06b6d4",
  "#059669",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#9333ea",
  "#6b7280",
  "#94a3b8",
  "#93c5fd",
  "#7dd3fc",
  "#a5f3fc",
  "#a7f3d0",
  "#bef264",
  "#fde047",
  "#fdba74",
  "#fca5a5",
  "#d8b4fe",
  "#ffffff",
] as const;

const STANDARD_COLORS = [
  "#dc2626",
  "#ff0000",
  "#f59e0b",
  "#ffff00",
  "#84cc16",
  "#00b050",
  "#06b6d4",
  "#0070c0",
  "#002060",
  "#7030a0",
] as const;

const HIGHLIGHT_COLORS = [
  "#fff59d",
  "#ffe082",
  "#ffcc80",
  "#ffab91",
  "#ef9a9a",
  "#f48fb1",
  "#ce93d8",
  "#b39ddb",
  "#9fa8da",
  "#90caf9",
  "#81d4fa",
  "#80deea",
  "#80cbc4",
  "#a5d6a7",
  "#c5e1a5",
  "#e6ee9c",
] as const;

function addColorControls(root: HTMLElement, crepe: Crepe) {
  const toolbar = root.querySelector<HTMLElement>(
    ".milkdown-top-bar .top-bar-inner",
  );
  if (!toolbar || toolbar.querySelector(".text-color-control")) return;

  const divider = document.createElement("span");
  divider.className = "top-bar-divider text-color-divider";

  const wrapper = document.createElement("div");
  wrapper.className = "text-color-picker";

  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "top-bar-item text-color-control";
  picker.dataset.tooltip = "字体颜色";
  picker.setAttribute("aria-label", "打开字体颜色菜单");
  picker.setAttribute("aria-expanded", "false");
  picker.innerHTML =
    '<span class="text-color-letter" aria-hidden="true">A</span><span class="text-color-chevron" aria-hidden="true">⌄</span>';

  const palette = document.createElement("div");
  palette.className = "text-color-palette";
  palette.hidden = true;

  const closePalette = () => {
    palette.hidden = true;
    picker.setAttribute("aria-expanded", "false");
  };
  const selectColor = (color: string | null) => {
    if (color) picker.style.setProperty("--selected-color", color);
    applyTextColor(crepe, color);
    closePalette();
  };

  const automatic = document.createElement("button");
  automatic.type = "button";
  automatic.className = "color-menu-row color-automatic";
  automatic.innerHTML =
    '<span class="automatic-color"></span><span>自动</span>';
  automatic.addEventListener("click", () => selectColor(null));
  palette.append(automatic);

  const addSwatchSection = (title: string, colors: readonly string[]) => {
    const heading = document.createElement("div");
    heading.className = "color-section-title";
    heading.textContent = title;
    const grid = document.createElement("div");
    grid.className = "color-swatch-grid";
    colors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `设置字体颜色 ${color}`);
      swatch.addEventListener("click", () => selectColor(color));
      grid.append(swatch);
    });
    palette.append(heading, grid);
  };

  addSwatchSection("主题颜色", THEME_COLORS);
  addSwatchSection("标准色", STANDARD_COLORS);

  const input = document.createElement("input");
  input.type = "color";
  input.value = "#2f6bed";
  input.setAttribute("aria-label", "选择字体颜色");
  input.addEventListener("input", () => {
    selectColor(input.value);
  });

  const moreColors = document.createElement("label");
  moreColors.className = "color-menu-row color-more";
  moreColors.innerHTML =
    '<span class="color-wheel" aria-hidden="true"></span><span>更多颜色…</span>';
  moreColors.append(input);
  palette.append(moreColors);

  const EyeDropperClass = (
    window as typeof window & {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    }
  ).EyeDropper;
  if (EyeDropperClass) {
    const eyedropper = document.createElement("button");
    eyedropper.type = "button";
    eyedropper.className = "color-menu-row";
    eyedropper.innerHTML =
      '<span aria-hidden="true">⌖</span><span>取色器</span>';
    eyedropper.addEventListener("click", async () => {
      try {
        const result = await new EyeDropperClass().open();
        selectColor(result.sRGBHex);
      } catch {
        // 用户取消取色时保持菜单状态，不修改当前颜色。
      }
    });
    palette.append(eyedropper);
  }

  picker.addEventListener("click", (event) => {
    event.stopPropagation();
    palette.hidden = !palette.hidden;
    picker.setAttribute("aria-expanded", String(!palette.hidden));
  });
  wrapper.addEventListener("click", (event) => event.stopPropagation());
  root.addEventListener("click", closePalette);

  wrapper.append(picker, palette);
  toolbar.append(divider, wrapper);

  const backgroundWrapper = document.createElement("div");
  backgroundWrapper.className = "text-color-picker";

  const backgroundPicker = document.createElement("button");
  backgroundPicker.type = "button";
  backgroundPicker.className =
    "top-bar-item text-color-control background-color-control";
  backgroundPicker.dataset.tooltip = "文本背景色";
  backgroundPicker.setAttribute("aria-label", "打开文本背景色菜单");
  backgroundPicker.setAttribute("aria-expanded", "false");
  backgroundPicker.innerHTML =
    '<span class="text-color-letter" aria-hidden="true">A</span><span class="text-color-chevron" aria-hidden="true">⌄</span>';

  const backgroundPalette = document.createElement("div");
  backgroundPalette.className = "text-color-palette";
  backgroundPalette.hidden = true;

  const closeBackgroundPalette = () => {
    backgroundPalette.hidden = true;
    backgroundPicker.setAttribute("aria-expanded", "false");
  };
  const selectBackground = (color: string | null) => {
    if (color) backgroundPicker.style.setProperty("--selected-color", color);
    applyTextBackground(crepe, color);
    closeBackgroundPalette();
  };

  const noFill = document.createElement("button");
  noFill.type = "button";
  noFill.className = "color-menu-row color-automatic";
  noFill.innerHTML =
    '<span class="automatic-color no-fill-color"></span><span>无填充</span>';
  noFill.addEventListener("click", () => selectBackground(null));

  const backgroundHeading = document.createElement("div");
  backgroundHeading.className = "color-section-title";
  backgroundHeading.textContent = "高亮颜色";
  const backgroundGrid = document.createElement("div");
  backgroundGrid.className = "color-swatch-grid";
  HIGHLIGHT_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.setAttribute("aria-label", `设置文本背景色 ${color}`);
    swatch.addEventListener("click", () => selectBackground(color));
    backgroundGrid.append(swatch);
  });

  const backgroundInput = document.createElement("input");
  backgroundInput.type = "color";
  backgroundInput.value = "#fff59d";
  backgroundInput.setAttribute("aria-label", "选择文本背景色");
  backgroundInput.addEventListener("input", () => {
    selectBackground(backgroundInput.value);
  });
  const moreBackgroundColors = document.createElement("label");
  moreBackgroundColors.className = "color-menu-row color-more";
  moreBackgroundColors.innerHTML =
    '<span class="color-wheel" aria-hidden="true"></span><span>更多颜色…</span>';
  moreBackgroundColors.append(backgroundInput);

  backgroundPalette.append(
    noFill,
    backgroundHeading,
    backgroundGrid,
    moreBackgroundColors,
  );
  backgroundPicker.addEventListener("click", (event) => {
    event.stopPropagation();
    backgroundPalette.hidden = !backgroundPalette.hidden;
    backgroundPicker.setAttribute(
      "aria-expanded",
      String(!backgroundPalette.hidden),
    );
  });
  backgroundWrapper.addEventListener("click", (event) =>
    event.stopPropagation(),
  );
  root.addEventListener("click", closeBackgroundPalette);
  backgroundWrapper.append(backgroundPicker, backgroundPalette);
  toolbar.append(backgroundWrapper);
}

function enhanceToolbar(root: HTMLElement, crepe: Crepe) {
  const headingButton = root.querySelector<HTMLButtonElement>(
    ".milkdown-top-bar .top-bar-heading-button",
  );
  if (headingButton) {
    headingButton.title = "段落与标题";
    headingButton.dataset.tooltip = "段落与标题";
    headingButton.setAttribute("aria-label", "选择段落或标题样式");
  }

  const toolButtons = root.querySelectorAll<HTMLButtonElement>(
    ".milkdown-top-bar .top-bar-item",
  );
  toolButtons.forEach((button, index) => {
    const tooltip = TOP_BAR_TOOLTIPS[index];
    if (!tooltip) return;
    button.title = tooltip;
    button.dataset.tooltip = tooltip;
    button.setAttribute("aria-label", tooltip);
  });
  addColorControls(root, crepe);
}

interface VisualEditorProps {
  initialMarkdown: string;
  dark: boolean;
  onChange: (markdown: string) => void;
}

export const VisualEditor = forwardRef<EditorHandle, VisualEditorProps>(
  function VisualEditor({ initialMarkdown, dark, onChange }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const crepeRef = useRef<Crepe | null>(null);
    const onChangeRef = useRef(onChange);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => crepeRef.current?.getMarkdown() ?? initialMarkdown,
      undo: () => {
        crepeRef.current?.editor.action(callCommand(undoCommand.key));
      },
      redo: () => {
        crepeRef.current?.editor.action(callCommand(redoCommand.key));
      },
    }));

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      if (!rootRef.current) return;

      const root = rootRef.current;
      let disposed = false;

      const crepe = new Crepe({
        root,
        defaultValue: initialMarkdown,
        features: {
          [CrepeFeature.TopBar]: true,
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.AI]: false,
        },
        featureConfigs: {
          [CrepeFeature.TopBar]: {
            headingOptions: [
              { label: "正文", level: null },
              { label: "一级标题", level: 1 },
              { label: "二级标题", level: 2 },
              { label: "三级标题", level: 3 },
              { label: "四级标题", level: 4 },
              { label: "五级标题", level: 5 },
              { label: "六级标题", level: 6 },
            ],
          },
          [CrepeFeature.BlockEdit]: {
            textGroup: {
              label: "文本",
              text: { label: "正文" },
              h1: { label: "一级标题" },
              h2: { label: "二级标题" },
              h3: { label: "三级标题" },
              h4: { label: "四级标题" },
              h5: { label: "五级标题" },
              h6: { label: "六级标题" },
              quote: { label: "引用" },
              divider: { label: "分隔线" },
            },
            listGroup: {
              label: "列表",
              bulletList: { label: "无序列表" },
              orderedList: { label: "有序列表" },
              taskList: { label: "任务列表" },
            },
            advancedGroup: {
              label: "高级",
              image: { label: "图片" },
              codeBlock: { label: "代码块" },
              table: { label: "表格" },
              math: { label: "数学公式" },
            },
          },
          [CrepeFeature.Cursor]: {
            virtual: false,
          },
          [CrepeFeature.Placeholder]: {
            text: "输入 / 选择内容块，开始编写 Markdown…",
          },
        },
      });
      crepeRef.current = crepe;
      configureTextColor(crepe);

      const toolbarObserver = new MutationObserver(() => {
        enhanceToolbar(root, crepe);
      });
      toolbarObserver.observe(root, { childList: true, subtree: true });

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
          if (markdown !== previousMarkdown) onChangeRef.current(markdown);
        });
      });

      void crepe.create().then(() => {
        if (!disposed) enhanceToolbar(root, crepe);
      });
      return () => {
        disposed = true;
        crepeRef.current = null;
        toolbarObserver.disconnect();
        void crepe.destroy();
      };
    }, []);

    return (
      <div
        ref={rootRef}
        className={`visual-editor ${dark ? "frame-dark" : "frame"}`}
      />
    );
  },
);
