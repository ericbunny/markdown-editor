import { editorViewCtx, remarkStringifyOptionsCtx } from "@milkdown/core";
import { $markSchema, $remark } from "@milkdown/utils";
import type { Crepe } from "@milkdown/crepe";

interface MarkdownNode {
  type: string;
  value?: string;
  color?: string;
  backgroundColor?: string;
  children?: MarkdownNode[];
}

interface MarkdownStringifyState {
  containerPhrasing: (
    node: MarkdownNode,
    info: Record<string, unknown>,
  ) => string;
}

const STYLE_OPEN =
  /^<span style=["'](color|background-color):\s*(#[0-9a-fA-F]{6})["']>$/;

function findClosingSpan(children: MarkdownNode[], openingIndex: number) {
  let depth = 0;
  for (let index = openingIndex + 1; index < children.length; index += 1) {
    const candidate = children[index];
    if (candidate.type !== "html") continue;
    if (candidate.value?.startsWith("<span ")) depth += 1;
    if (candidate.value === "</span>") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function transformColorSpans(node: MarkdownNode) {
  if (!node.children) return;

  for (let index = 0; index < node.children.length; index += 1) {
    const opening = node.children[index];
    if (opening.type !== "html") continue;

    const match = opening.value?.match(STYLE_OPEN);
    if (!match) continue;

    const closingIndex = findClosingSpan(node.children, index);
    if (closingIndex < 0) continue;

    const children = node.children.slice(index + 1, closingIndex);
    transformColorSpans({ type: "root", children });
    const styled: MarkdownNode = {
      type: match[1] === "color" ? "textColor" : "textBackground",
      children,
    };
    if (match[1] === "color") styled.color = match[2].toLowerCase();
    else styled.backgroundColor = match[2].toLowerCase();
    node.children.splice(index, closingIndex - index + 1, styled);
  }

  node.children.forEach(transformColorSpans);
}

export const textColorRemark = $remark(
  "textColorRemark",
  () => () => transformColorSpans,
);

export const textColorSchema = $markSchema("textColor", () => ({
  attrs: {
    color: { default: "#2f6bed", validate: "string" },
  },
  parseDOM: [
    {
      tag: "span[data-text-color]",
      getAttrs: (element) => ({ color: element.dataset.textColor }),
    },
    {
      style: "color",
      getAttrs: (color) => ({ color }),
    },
  ],
  toDOM: (mark) => [
    "span",
    {
      "data-text-color": mark.attrs.color,
      style: `color: ${mark.attrs.color}`,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "textColor",
    runner: (state, node, markType) => {
      state.openMark(markType, { color: node.color });
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "textColor",
    runner: (state, mark) => {
      state.withMark(mark, "textColor", undefined, {
        color: mark.attrs.color,
      });
    },
  },
}));

export const textBackgroundSchema = $markSchema("textBackground", () => ({
  attrs: {
    backgroundColor: { default: "#fff59d", validate: "string" },
  },
  parseDOM: [
    {
      tag: "span[data-text-background]",
      getAttrs: (element) => ({
        backgroundColor: element.dataset.textBackground,
      }),
    },
    {
      style: "background-color",
      getAttrs: (backgroundColor) => ({ backgroundColor }),
    },
  ],
  toDOM: (mark) => [
    "span",
    {
      "data-text-background": mark.attrs.backgroundColor,
      style: `background-color: ${mark.attrs.backgroundColor}`,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "textBackground",
    runner: (state, node, markType) => {
      state.openMark(markType, { backgroundColor: node.backgroundColor });
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "textBackground",
    runner: (state, mark) => {
      state.withMark(mark, "textBackground", undefined, {
        backgroundColor: mark.attrs.backgroundColor,
      });
    },
  },
}));

export function configureTextColor(crepe: Crepe) {
  crepe.editor
    .config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        handlers: {
          ...options.handlers,
          textColor: (
            node: MarkdownNode,
            _parent: MarkdownNode | undefined,
            state: MarkdownStringifyState,
            info: Record<string, unknown>,
          ) => {
            const color = String(node.color);
            const opening = `<span style="color: ${color}">`;
            const closing = "</span>";
            return `${opening}${state.containerPhrasing(node, {
              ...info,
              before: opening,
              after: closing,
            })}${closing}`;
          },
          textBackground: (
            node: MarkdownNode,
            _parent: MarkdownNode | undefined,
            state: MarkdownStringifyState,
            info: Record<string, unknown>,
          ) => {
            const color = String(node.backgroundColor);
            const opening = `<span style="background-color: ${color}">`;
            const closing = "</span>";
            return `${opening}${state.containerPhrasing(node, {
              ...info,
              before: opening,
              after: closing,
            })}${closing}`;
          },
        },
      }));
    })
    .use(textColorRemark)
    .use(textColorSchema)
    .use(textBackgroundSchema);
}

export function applyTextColor(crepe: Crepe, color: string | null) {
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to, empty } = view.state.selection;
    const markType = textColorSchema.type(ctx);
    let transaction = view.state.tr;

    if (empty) {
      transaction = transaction.removeStoredMark(markType);
      if (color)
        transaction = transaction.addStoredMark(markType.create({ color }));
    } else {
      transaction = transaction.removeMark(from, to, markType);
      if (color)
        transaction = transaction.addMark(from, to, markType.create({ color }));
    }

    view.dispatch(transaction.scrollIntoView());
    view.focus();
  });
}

export function applyTextBackground(crepe: Crepe, color: string | null) {
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to, empty } = view.state.selection;
    const markType = textBackgroundSchema.type(ctx);
    let transaction = view.state.tr;

    if (empty) {
      transaction = transaction.removeStoredMark(markType);
      if (color)
        transaction = transaction.addStoredMark(
          markType.create({ backgroundColor: color }),
        );
    } else {
      transaction = transaction.removeMark(from, to, markType);
      if (color)
        transaction = transaction.addMark(
          from,
          to,
          markType.create({ backgroundColor: color }),
        );
    }

    view.dispatch(transaction.scrollIntoView());
    view.focus();
  });
}
