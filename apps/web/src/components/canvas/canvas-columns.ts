import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvasColumns: {
      /** Drop in a side-by-side layout with `count` columns (2 or 3). */
      insertColumns: (count?: 2 | 3) => ReturnType;
    };
  }
}

/** One column of a `columnList` — holds any blocks. */
export const CanvasColumn = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div[data-canvas-column]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-canvas-column": "" }), 0];
  },
});

/** A row of side-by-side columns (Notion's "Layouts"). */
export const CanvasColumns = Node.create({
  name: "columnList",
  group: "block",
  content: "column column+",

  parseHTML() {
    return [{ tag: "div[data-canvas-columns]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-canvas-columns": "", class: "canvas-columns" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertColumns:
        (count = 2) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }, () => ({
              type: "column",
              content: [{ type: "paragraph" }],
            })),
          }),
    };
  },
});
