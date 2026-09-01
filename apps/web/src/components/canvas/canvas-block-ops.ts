import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/** The block the drag handle is currently pointing at. */
export interface BlockTarget {
  node: PMNode;
  /** Document position immediately before the node. */
  pos: number;
}

/** Block shapes the "Turn into" submenu can produce. */
export type TurnIntoKind =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock";

export const TURN_INTO_ITEMS: { kind: TurnIntoKind; label: string }[] = [
  { kind: "paragraph", label: "Text" },
  { kind: "h1", label: "Heading 1" },
  { kind: "h2", label: "Heading 2" },
  { kind: "h3", label: "Heading 3" },
  { kind: "bulletList", label: "Bulleted list" },
  { kind: "orderedList", label: "Numbered list" },
  { kind: "taskList", label: "To-do list" },
  { kind: "blockquote", label: "Quote" },
  { kind: "codeBlock", label: "Code" },
];

/** Drop an empty paragraph directly after the target and put the caret in it. */
export function insertBlockBelow(editor: Editor, target: BlockTarget): void {
  const at = target.pos + target.node.nodeSize;
  editor
    .chain()
    .insertContentAt(at, { type: "paragraph" })
    .setTextSelection(at + 1)
    .focus()
    .run();
}

/** Copy the target block in right below itself. */
export function duplicateBlock(editor: Editor, target: BlockTarget): void {
  editor
    .chain()
    .insertContentAt(target.pos + target.node.nodeSize, target.node.toJSON())
    .focus()
    .run();
}

/** Remove the target block. */
export function deleteBlock(editor: Editor, target: BlockTarget): void {
  editor
    .chain()
    .deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize })
    .focus()
    .run();
}

/**
 * Swap the target block with its previous / next sibling. Returns false when the
 * block is already at that edge, or is nested somewhere this can't reason about.
 */
export function moveBlock(editor: Editor, target: BlockTarget, direction: "up" | "down"): boolean {
  const { state } = editor.view;
  const $pos = state.doc.resolve(target.pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const nodeStart = target.pos;
  const nodeEnd = target.pos + target.node.nodeSize;

  if (direction === "up") {
    if (index === 0) return false;
    const prev = parent.child(index - 1);
    const tr = state.tr.delete(nodeStart, nodeEnd);
    tr.insert(tr.mapping.map(nodeStart - prev.nodeSize), target.node);
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  }

  if (index >= parent.childCount - 1) return false;
  const next = parent.child(index + 1);
  const tr = state.tr.delete(nodeStart, nodeEnd);
  tr.insert(tr.mapping.map(nodeEnd + next.nodeSize), target.node);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Convert the target block to another shape (Notion's "Turn into"). */
export function turnBlockInto(editor: Editor, target: BlockTarget, kind: TurnIntoKind): void {
  // Land the selection inside the block so the toggle/set commands have something
  // to act on, then apply the shape.
  const chain = editor.chain().focus().setTextSelection(target.pos + 1);

  switch (kind) {
    case "paragraph":
      chain.setParagraph();
      break;
    case "h1":
      chain.setNode("heading", { level: 1 });
      break;
    case "h2":
      chain.setNode("heading", { level: 2 });
      break;
    case "h3":
      chain.setNode("heading", { level: 3 });
      break;
    case "bulletList":
      chain.toggleBulletList();
      break;
    case "orderedList":
      chain.toggleOrderedList();
      break;
    case "taskList":
      chain.toggleTaskList();
      break;
    case "blockquote":
      chain.toggleBlockquote();
      break;
    case "codeBlock":
      chain.toggleCodeBlock();
      break;
  }

  chain.run();
}
