import { useRef, useState, type ReactNode } from "react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Editor } from "@tiptap/react";
import clsx from "clsx";
import {
  Plus,
  GripVertical,
  Repeat2,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../ui/dropdown-menu";
import {
  type BlockTarget,
  type TurnIntoKind,
  TURN_INTO_ITEMS,
  insertBlockBelow,
  duplicateBlock,
  deleteBlock,
  moveBlock,
  turnBlockInto,
} from "./canvas-block-ops";

const TURN_INTO_ICONS: Record<TurnIntoKind, ReactNode> = {
  paragraph: <Type className="w-4 h-4" />,
  h1: <Heading1 className="w-4 h-4" />,
  h2: <Heading2 className="w-4 h-4" />,
  h3: <Heading3 className="w-4 h-4" />,
  bulletList: <List className="w-4 h-4" />,
  orderedList: <ListOrdered className="w-4 h-4" />,
  taskList: <ListTodo className="w-4 h-4" />,
  blockquote: <Quote className="w-4 h-4" />,
  codeBlock: <Code className="w-4 h-4" />,
};

const gripBtn =
  "flex items-center justify-center w-5 h-6 rounded text-faint hover:text-secondary hover:bg-surface-hover border-none bg-transparent transition-colors";

/**
 * The gutter handle for a canvas block: a "+" that adds a line underneath and a
 * grip that both drags the block and opens its action menu.
 */
export function CanvasBlockHandle({ editor }: { editor: Editor }) {
  const targetRef = useRef<BlockTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const withTarget = (fn: (target: BlockTarget) => void) => {
    const target = targetRef.current;
    if (target) fn(target);
  };

  return (
    // Top-level blocks only (no `nested`): the handle then always aligns to the
    // document's left edge and sits in the gutter, instead of landing on a list
    // bullet or an ordered-list number.
    <DragHandle
      editor={editor}
      onNodeChange={({ node, pos }) => {
        targetRef.current = node ? { node, pos } : null;
        if (!node) setMenuOpen(false);
      }}
    >
      <div className="flex items-center gap-0.5 pr-1.5" data-testid="canvas-block-handle">
        <button
          type="button"
          aria-label="Add block below"
          title="Add block below"
          data-testid="canvas-block-add"
          // Keep this a plain click — don't let the drag plugin grab it.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => withTarget((target) => insertBlockBelow(editor, target))}
          className={clsx(gripBtn, "cursor-pointer")}
        >
          <Plus className="w-4 h-4" />
        </button>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Block actions"
              title="Drag to move · click for actions"
              data-testid="canvas-drag-handle"
              className={clsx(gripBtn, "cursor-grab active:cursor-grabbing")}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={6}
            data-testid="canvas-block-menu"
            className="py-1"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2.5">
                <Repeat2 className="w-4 h-4" />
                Turn into
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="py-1">
                {TURN_INTO_ITEMS.map(({ kind, label }) => (
                  <DropdownMenuItem
                    key={kind}
                    data-testid={`canvas-turn-${kind}`}
                    className="flex items-center gap-2.5"
                    onSelect={() => withTarget((target) => turnBlockInto(editor, target, kind))}
                  >
                    {TURN_INTO_ICONS[kind]}
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem
              data-testid="canvas-block-move-up"
              className="flex items-center gap-2.5"
              onSelect={() => withTarget((target) => moveBlock(editor, target, "up"))}
            >
              <ArrowUp className="w-4 h-4" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="canvas-block-move-down"
              className="flex items-center gap-2.5"
              onSelect={() => withTarget((target) => moveBlock(editor, target, "down"))}
            >
              <ArrowDown className="w-4 h-4" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="canvas-block-duplicate"
              className="flex items-center gap-2.5"
              onSelect={() => withTarget((target) => duplicateBlock(editor, target))}
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              data-testid="canvas-block-delete"
              className="flex items-center gap-2.5 text-danger-text"
              onSelect={() => withTarget((target) => deleteBlock(editor, target))}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DragHandle>
  );
}
