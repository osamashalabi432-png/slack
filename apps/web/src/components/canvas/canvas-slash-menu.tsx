import { forwardRef, useEffect, useImperativeHandle, useState, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";
import type { DatabasePreset } from "@openslaq/shared";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Type,
  Table2,
  LayoutGrid,
  CalendarDays,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

export interface CanvasBlockItem {
  id: string;
  title: string;
  hint: string;
  keywords: string[];
  icon: React.ReactNode;
  run: (editor: Editor, range: Range) => void;
}

/** Blocks offered by the "/" menu, in menu order. */
export const CANVAS_BLOCKS: CanvasBlockItem[] = [
  {
    id: "text",
    title: "Text",
    hint: "Plain paragraph",
    keywords: ["text", "paragraph", "plain"],
    icon: <Type className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "h1",
    title: "Heading 1",
    hint: "Big section heading",
    keywords: ["h1", "heading", "title", "large"],
    icon: <Heading1 className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "h2",
    title: "Heading 2",
    hint: "Medium section heading",
    keywords: ["h2", "heading", "subtitle"],
    icon: <Heading2 className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "h3",
    title: "Heading 3",
    hint: "Small section heading",
    keywords: ["h3", "heading", "small"],
    icon: <Heading3 className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "todo",
    title: "To-do list",
    hint: "Track tasks with checkboxes",
    keywords: ["todo", "task", "check", "checkbox"],
    icon: <ListTodo className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "bullet",
    title: "Bulleted list",
    hint: "A simple bulleted list",
    keywords: ["bullet", "list", "unordered"],
    icon: <List className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered",
    title: "Numbered list",
    hint: "A list with numbering",
    keywords: ["number", "ordered", "list"],
    icon: <ListOrdered className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "quote",
    title: "Quote",
    hint: "Call out a quotation",
    keywords: ["quote", "blockquote", "callout"],
    icon: <Quote className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code",
    title: "Code block",
    hint: "Syntax-highlighted code",
    keywords: ["code", "snippet", "pre"],
    icon: <Code className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "table",
    title: "Table",
    hint: "An empty table — add rows and columns as you go",
    keywords: ["table", "grid", "rows", "columns", "spreadsheet", "cells"],
    icon: <Table2 className="w-4 h-4" />,
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    title: "Divider",
    hint: "Visually separate sections",
    keywords: ["divider", "rule", "line", "hr", "separator"],
    icon: <Minus className="w-4 h-4" />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

/**
 * Match score, lower = better. A hit on the block's own name always beats a hit
 * on its keywords/description, so `/pa` lands on **Page** before **Text** (whose
 * "paragraph" keyword also matches).
 */
function matchRank(block: CanvasBlockItem, q: string): number {
  const title = block.title.toLowerCase();
  if (title.startsWith(q)) return 0;
  if (title.includes(q)) return 1;
  if (block.keywords.some((k) => k.toLowerCase().startsWith(q))) return 2;
  if (block.keywords.some((k) => k.toLowerCase().includes(q))) return 3;
  return Infinity;
}

export function filterCanvasBlocks(query: string, extra: CanvasBlockItem[] = []): CanvasBlockItem[] {
  const all = [...CANVAS_BLOCKS, ...extra];
  const q = query.trim().toLowerCase();
  if (!q) return all;

  return all
    .map((block, index) => ({ block, index, rank: matchRank(block, q) }))
    .filter((entry) => entry.rank !== Infinity)
    // Stable: fall back to the original menu order within a rank.
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.block);
}

/**
 * Data blocks defer creation to the host, which has to mint the dataset
 * server-side before the node can be inserted. Each preset is offered as its
 * own entry so a calendar can be dropped in without a full database.
 */
/**
 * "/page" creates a page inside the one being edited and leaves a link to it
 * in the body, rather than sending you to the sidebar to make one.
 */
export function pageBlockItem(onCreatePage: () => void): CanvasBlockItem {
  return {
    id: "page",
    title: "Page",
    hint: "A page inside this page",
    keywords: ["page", "sub", "subpage", "child", "doc", "document"],
    icon: <FileText className="w-4 h-4" />,
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      onCreatePage();
    },
  };
}

/** "/image" opens a file picker; pasting or dropping one works as well. */
export function imageBlockItem(onInsertImage: () => void): CanvasBlockItem {
  return {
    id: "image",
    title: "Image",
    hint: "Upload one, or paste it straight in",
    keywords: ["image", "picture", "photo", "img", "screenshot", "upload"],
    icon: <ImageIcon className="w-4 h-4" />,
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      onInsertImage();
    },
  };
}

export function dataBlockItems(
  onCreateDatabase: (preset: DatabasePreset) => void,
): CanvasBlockItem[] {
  const make = (
    preset: DatabasePreset,
    title: string,
    hint: string,
    keywords: string[],
    icon: React.ReactNode,
  ): CanvasBlockItem => ({
    id: preset === "full" ? "database" : preset,
    title,
    hint,
    keywords,
    icon,
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      onCreateDatabase(preset);
    },
  });

  return [
    make(
      "calendar",
      "Calendar",
      "Schedule entries on a month grid",
      ["calendar", "month", "schedule", "date", "agenda"],
      <CalendarDays className="w-4 h-4" />,
    ),
    make(
      "board",
      "Board",
      "Kanban columns you can drag between",
      ["board", "kanban", "columns", "status"],
      <LayoutGrid className="w-4 h-4" />,
    ),
    make(
      "full",
      "Database",
      "Typed columns with board and table views",
      ["database", "project", "tasks", "all", "typed"],
      <Table2 className="w-4 h-4" />,
    ),
  ];
}

export interface CanvasSlashListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CanvasSlashListProps {
  items: CanvasBlockItem[];
  command: (item: CanvasBlockItem) => void;
}

export const CanvasSlashList = forwardRef<CanvasSlashListRef, CanvasSlashListProps>(
  function CanvasSlashList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="w-[280px] rounded-lg border border-border-default bg-surface shadow-lg p-3 text-[13px] text-muted">
          No blocks found
        </div>
      );
    }

    return (
      <div
        data-testid="canvas-slash-menu"
        className="w-[280px] max-h-[320px] overflow-y-auto rounded-lg border border-border-default bg-surface shadow-lg py-1"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-testid={`canvas-block-${item.id}`}
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
            onMouseEnter={() => setSelected(index)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left border-none cursor-pointer transition-colors ${
              index === selected ? "bg-surface-hover" : "bg-transparent"
            }`}
          >
            <span className="w-7 h-7 rounded border border-border-default flex items-center justify-center text-secondary shrink-0">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-primary truncate">{item.title}</span>
              <span className="block text-[11px] text-muted truncate">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);

/** Positions the menu under the caret, flipping above when short on space. */
function place(container: HTMLDivElement, props: SuggestionProps<CanvasBlockItem>) {
  const rect = (props.decorationNode as HTMLElement | null)?.getBoundingClientRect();
  if (!rect) return;
  const spaceBelow = window.innerHeight - rect.bottom;
  container.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
  if (spaceBelow < 340) {
    container.style.top = "";
    container.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  } else {
    container.style.bottom = "";
    container.style.top = `${rect.bottom + 6}px`;
  }
}

function createCanvasSlashSuggestion(
  getExtraBlocks: () => CanvasBlockItem[],
): Omit<SuggestionOptions<CanvasBlockItem>, "editor"> {
  return {
    char: "/",
    startOfLine: false,
    items: ({ query }) => filterCanvasBlocks(query, getExtraBlocks()),
    command: ({ editor, range, props }) => props.run(editor, range),
    render: () => {
      let container: HTMLDivElement | null = null;
      let root: Root | null = null;
      let ref: CanvasSlashListRef | null = null;

      const teardown = () => {
        if (!container) return;
        root?.unmount();
        container.remove();
        container = null;
        root = null;
        ref = null;
      };

      const draw = (props: SuggestionProps<CanvasBlockItem>) => {
        if (!container || !root) return;
        place(container, props);
        root.render(
          createElement(CanvasSlashList, {
            items: props.items,
            command: props.command,
            ref: (r: CanvasSlashListRef | null) => {
              ref = r;
            },
          }),
        );
      };

      return {
        onStart: (props) => {
          container = document.createElement("div");
          container.style.position = "fixed";
          container.style.zIndex = "60";
          document.body.appendChild(container);
          root = createRoot(container);
          draw(props);
        },
        onUpdate: draw,
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            teardown();
            return true;
          }
          return ref?.onKeyDown(props) ?? false;
        },
        onExit: teardown,
      };
    },
  };
}

interface CanvasSlashMenuOptions {
  /** Invoked when the user picks one of the data blocks. */
  onCreateDatabase?: ((preset: DatabasePreset) => void) | null;
  /** Invoked for "/page" — mints a sub-page and drops a link to it here. */
  onCreatePage?: (() => void) | null;
  /** Invoked for "/image" — opens a picker and drops the image in. */
  onInsertImage?: (() => void) | null;
}

/** TipTap extension that turns "/" into a Notion-style block picker. */
export const CanvasSlashMenu = Extension.create<CanvasSlashMenuOptions>({
  name: "canvasSlashMenu",

  addOptions() {
    return { onCreateDatabase: null, onCreatePage: null, onInsertImage: null };
  },

  addProseMirrorPlugins() {
    const getExtraBlocks = () => {
      const blocks = [];
      const createPage = this.options.onCreatePage;
      // A page comes first: nesting a page is the most common thing to reach
      // for, and Notion puts it at the top of the list too.
      if (createPage) blocks.push(pageBlockItem(createPage));
      const insertImage = this.options.onInsertImage;
      if (insertImage) blocks.push(imageBlockItem(insertImage));
      const handler = this.options.onCreateDatabase;
      if (handler) blocks.push(...dataBlockItems(handler));
      return blocks;
    };

    return [
      Suggestion({
        editor: this.editor,
        ...createCanvasSlashSuggestion(getExtraBlocks),
      }),
    ];
  },
});
