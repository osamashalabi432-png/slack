import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import clsx from "clsx";
import {
  Plus,
  X,
  Type,
  Smile,
  Paperclip,
  CheckSquare,
  Table2,
  Columns2,
  Minus,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Image as ImageIcon,
  FileText as PageIcon,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import { EmojiPicker } from "../message/EmojiPicker";

interface CanvasBottomToolbarProps {
  editor: Editor;
  /**
   * The scrolling document viewport. The bar is pinned to a fixed offset from
   * its bottom edge and centred on its width, so it holds still while editing.
   */
  containerRef?: RefObject<HTMLElement | null>;
  /** Opens an image picker and inserts the result; omit to hide the image tools. */
  onPickImage?: () => void;
  /** "/page"-style: mint a child page and link to it. */
  onCreatePage?: () => void;
}

const item = "flex items-center gap-2.5 px-3 py-2 text-[13px]";

/**
 * The floating format bar. It is pinned to the viewport bottom (so it never
 * drifts up as the document grows or the caret moves) and only its horizontal
 * span is taken from the canvas column, so it stays centred on the canvas
 * rather than the whole window.
 */
export function CanvasBottomToolbar({
  editor,
  containerRef,
  onPickImage,
  onCreatePage,
}: CanvasBottomToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  // Horizontal bounds of the canvas column, so the pill centres on the canvas.
  const [span, setSpan] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSpan({ left: r.left, width: r.width });
    };
    measure();
    window.addEventListener("resize", measure);
    editor.on("transaction", measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener("resize", measure);
      editor.off("transaction", measure);
      ro?.disconnect();
    };
  }, [containerRef, editor]);

  const run = (fn: (chain: ReturnType<Editor["chain"]>) => unknown) => fn(editor.chain().focus());

  const blockBtn =
    "w-8 h-8 flex items-center justify-center rounded-md text-secondary hover:bg-surface-hover hover:text-primary border-none bg-transparent cursor-pointer transition-colors";

  const isActive = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);

  return (
    <TooltipProvider>
      <div
        data-testid="canvas-bottom-toolbar"
        className="pointer-events-none fixed bottom-5 z-30 flex justify-center"
        style={span ? { left: span.left, width: span.width } : { left: 0, right: 0 }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border-default bg-surface px-1.5 py-1 shadow-lg">
          {/* + — insert a block */}
          <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Insert block"
                data-testid="canvas-tb-add"
                className={clsx(
                  "w-8 h-8 flex items-center justify-center rounded-md border-none cursor-pointer transition-colors mr-1",
                  addOpen ? "bg-surface-tertiary text-primary" : "bg-slaq-green text-white hover:opacity-90",
                )}
              >
                {addOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="min-w-[220px]">
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.setHorizontalRule().run())}>
                <Minus className="w-4 h-4" /> Divider
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleBlockquote().run())}>
                <Quote className="w-4 h-4" /> Blockquote
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleBulletList().run())}>
                <List className="w-4 h-4" /> Bulleted list
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleOrderedList().run())}>
                <ListOrdered className="w-4 h-4" /> Numbered list
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleTaskList().run())}>
                <ListChecks className="w-4 h-4" /> Check list
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.insertColumns(2).run())}>
                <Columns2 className="w-4 h-4" /> Columns
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
                <Table2 className="w-4 h-4" /> Table
              </DropdownMenuItem>
              {onPickImage && (
                <DropdownMenuItem className={item} onSelect={onPickImage}>
                  <ImageIcon className="w-4 h-4" /> Image
                </DropdownMenuItem>
              )}
              {onCreatePage && (
                <DropdownMenuItem className={item} onSelect={onCreatePage}>
                  <PageIcon className="w-4 h-4" /> Page
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Aa — turn the current block into… */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Tooltip content="Turn into">
                <button type="button" aria-label="Text style" data-testid="canvas-tb-format" className={blockBtn}>
                  <Type className="w-4 h-4" />
                </button>
              </Tooltip>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="min-w-[220px]">
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleCodeBlock().run())}>
                <Code className="w-4 h-4" /> Code block
                {isActive("codeBlock") && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleBulletList().run())}>
                <List className="w-4 h-4" /> Bulleted list
                {isActive("bulletList") && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleOrderedList().run())}>
                <ListOrdered className="w-4 h-4" /> Ordered list
                {isActive("orderedList") && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleTaskList().run())}>
                <ListChecks className="w-4 h-4" /> Check list
                {isActive("taskList") && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleHeading({ level: 3 }).run())}>
                <Heading3 className="w-4 h-4" /> Small heading
                {isActive("heading", { level: 3 }) && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleHeading({ level: 2 }).run())}>
                <Heading2 className="w-4 h-4" /> Medium heading
                {isActive("heading", { level: 2 }) && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.toggleHeading({ level: 1 }).run())}>
                <Heading1 className="w-4 h-4" /> Big heading
                {isActive("heading", { level: 1 }) && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run((c) => c.setParagraph().run())}>
                <Pilcrow className="w-4 h-4" /> Paragraph
                {isActive("paragraph") && <Check className="ml-auto w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Emoji */}
          <Tooltip content="Emoji">
            <button
              ref={emojiBtnRef}
              type="button"
              aria-label="Insert emoji"
              data-testid="canvas-tb-emoji"
              onClick={() => setEmojiOpen((v) => !v)}
              className={blockBtn}
            >
              <Smile className="w-4 h-4" />
            </button>
          </Tooltip>

          {onPickImage && (
            <Tooltip content="Image">
              <button
                type="button"
                aria-label="Add image"
                data-testid="canvas-tb-image"
                onClick={onPickImage}
                className={blockBtn}
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Check list · Ctrl+Shift+9">
            <button
              type="button"
              aria-label="Check list"
              data-testid="canvas-tb-checklist"
              onClick={() => run((c) => c.toggleTaskList().run())}
              className={clsx(blockBtn, isActive("taskList") && "bg-surface-tertiary text-primary")}
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Table">
            <button
              type="button"
              aria-label="Insert table"
              data-testid="canvas-tb-table"
              onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
              className={blockBtn}
            >
              <Table2 className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Layouts">
            <button
              type="button"
              aria-label="Insert columns"
              data-testid="canvas-tb-layouts"
              onClick={() => run((c) => c.insertColumns(2).run())}
              className={blockBtn}
            >
              <Columns2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {emojiOpen && (
          <EmojiPicker
            anchorRef={emojiBtnRef}
            onSelect={(e) => {
              editor.chain().focus().insertContent(e).run();
              setEmojiOpen(false);
            }}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
