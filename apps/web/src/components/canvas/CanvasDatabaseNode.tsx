import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { DatabaseBlock } from "./DatabaseBlock";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvasDatabase: {
      /** Inserts a database block bound to an existing database id. */
      insertCanvasDatabase: (databaseId: string) => ReturnType;
    };
  }
}

function DatabaseNodeView({ node }: NodeViewProps) {
  const databaseId = node.attrs.databaseId as string | null;

  return (
    <NodeViewWrapper
      className="canvas-database-node"
      data-drag-handle
      contentEditable={false}
      suppressContentEditableWarning
    >
      {databaseId ? (
        <DatabaseBlock databaseId={databaseId} />
      ) : (
        <div className="my-3 rounded-lg border border-border-default p-3 text-[13px] text-muted">
          This database block is missing its id.
        </div>
      )}
    </NodeViewWrapper>
  );
}

/**
 * A block that renders a structured dataset. Only the id lives in the document;
 * the rows are stored separately so edits do not race the canvas autosave.
 */
export const CanvasDatabaseNode = Node.create({
  name: "canvasDatabase",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-database-id"),
        renderHTML: (attributes) => {
          if (!attributes.databaseId) return {};
          return { "data-database-id": attributes.databaseId as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-canvas-database]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-canvas-database": "" })];
  },

  addCommands() {
    return {
      insertCanvasDatabase:
        (databaseId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { databaseId } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeView);
  },
});
