import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { CodeBlockShiki } from "tiptap-extension-code-block-shiki";
import type { CanvasContent, DatabasePreset } from "@openslaq/shared";
import clsx from "clsx";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  Undo2,
  Redo2,
  Table2,
  BetweenVerticalEnd,
  BetweenHorizontalEnd,
  Columns3,
  Rows3,
  Trash2,
} from "lucide-react";
import { CanvasBlockHandle } from "./CanvasBlockHandle";
import { CanvasSlashMenu } from "./canvas-slash-menu";
import { CanvasDatabaseNode } from "./CanvasDatabaseNode";
import { PageLinkNode } from "./PageLinkNode";
import { CanvasImageNode } from "./CanvasImageNode";
import type { UploadedImage } from "../../hooks/useImageStore";
import "./canvas.css";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 900;

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Keep the selection while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "w-7 h-7 flex items-center justify-center rounded border-none cursor-pointer transition-colors bg-transparent",
        disabled && "opacity-40 cursor-not-allowed",
        active ? "bg-surface-selected text-slaq-blue" : "text-secondary hover:bg-surface-hover",
      )}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-border-default mx-1" />;
}

function CanvasToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-4 py-1.5 border-b border-border-default bg-surface sticky top-0 z-10">
      <ToolButton
        icon={<Bold className="w-4 h-4" />}
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={<Italic className="w-4 h-4" />}
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={<UnderlineIcon className="w-4 h-4" />}
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={<Strikethrough className="w-4 h-4" />}
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Divider />
      <ToolButton
        icon={<Heading1 className="w-4 h-4" />}
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolButton
        icon={<Heading2 className="w-4 h-4" />}
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={<Heading3 className="w-4 h-4" />}
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Divider />
      <ToolButton
        icon={<ListTodo className="w-4 h-4" />}
        label="To-do list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolButton
        icon={<List className="w-4 h-4" />}
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={<ListOrdered className="w-4 h-4" />}
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Divider />
      <ToolButton
        icon={<Quote className="w-4 h-4" />}
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        icon={<Code className="w-4 h-4" />}
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton
        icon={<Minus className="w-4 h-4" />}
        label="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolButton
        icon={<Table2 className="w-4 h-4" />}
        label="Insert table"
        active={editor.isActive("table")}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />
      {editor.isActive("table") && (
        <>
          <Divider />
          <ToolButton
            icon={<BetweenVerticalEnd className="w-4 h-4" />}
            label="Add column"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          />
          <ToolButton
            icon={<Columns3 className="w-4 h-4" />}
            label="Delete column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          />
          <ToolButton
            icon={<BetweenHorizontalEnd className="w-4 h-4" />}
            label="Add row"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          />
          <ToolButton
            icon={<Rows3 className="w-4 h-4" />}
            label="Delete row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          />
          <ToolButton
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </>
      )}
      <Divider />
      <ToolButton
        icon={<Undo2 className="w-4 h-4" />}
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        icon={<Redo2 className="w-4 h-4" />}
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

/** Image files from a paste or a drop, ignoring anything else carried along. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

interface CanvasEditorProps {
  /** Document body; null starts an empty canvas. */
  initialContent: CanvasContent | null;
  /** Persists the document. Resolves once the write lands. */
  onSave: (content: CanvasContent) => Promise<unknown>;
  editable?: boolean;
  onSaveStateChange?: (state: SaveState) => void;
  /** Changes when the document should be reloaded from props (e.g. tab switch). */
  documentKey: string;
  /** Creates a dataset server-side and returns its id, or null on failure. */
  onCreateDatabase?: (preset: DatabasePreset) => Promise<string | null>;
  /** Mints a sub-page and returns its id, so "/page" can link to it. */
  onCreatePage?: () => Promise<string | null>;
  /** Stores an image and says where it went, or null if it could not be kept. */
  onUploadImage?: (file: File) => Promise<UploadedImage | null>;
}

/**
 * Notion-style document editor. Edits autosave on a debounce; the pending
 * write is flushed on unmount so navigating away does not drop keystrokes.
 */
export function CanvasEditor({
  initialContent,
  onSave,
  editable = true,
  onSaveStateChange,
  documentKey,
  onCreateDatabase,
  onCreatePage,
  onUploadImage,
}: CanvasEditorProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<CanvasContent | null>(null);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  // Serialized form of what is currently persisted, so no-op transactions
  // (TipTap emits some on mount) don't overwrite the stored document.
  const savedJsonRef = useRef<string | null>(null);

  const setState = useCallback(
    (next: SaveState) => {
      setSaveState(next);
      onSaveStateChange?.(next);
    },
    [onSaveStateChange],
  );

  const flush = useCallback(async () => {
    const content = pendingRef.current;
    if (!content || savingRef.current) return;

    pendingRef.current = null;
    savingRef.current = true;
    setState("saving");
    const attempted = JSON.stringify(content);
    try {
      await onSaveRef.current(content);
      savedJsonRef.current = attempted;
      // Another edit arrived while the write was in flight.
      setState(pendingRef.current ? "dirty" : "saved");
    } catch {
      // Put the content back so the next attempt retries it.
      pendingRef.current = content;
      setState("error");
    } finally {
      savingRef.current = false;
    }
  }, [setState]);

  const scheduleSave = useCallback(
    (content: CanvasContent) => {
      // Nothing actually changed relative to what is stored.
      if (savedJsonRef.current !== null && JSON.stringify(content) === savedJsonRef.current) return;
      pendingRef.current = content;
      setState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush, setState],
  );

  const createDatabaseRef = useRef(onCreateDatabase);
  createDatabaseRef.current = onCreateDatabase;
  const editorRef = useRef<Editor | null>(null);

  const createPageRef = useRef(onCreatePage);
  createPageRef.current = onCreatePage;

  const handleCreatePage = useCallback(() => {
    const create = createPageRef.current;
    if (!create) return;
    void create().then((pageId) => {
      if (!pageId) return;
      editorRef.current?.chain().focus().insertPageLink(pageId).run();
      void flush();
    });
  }, [flush]);

  const uploadImageRef = useRef(onUploadImage);
  uploadImageRef.current = onUploadImage;

  /**
   * Puts a placeholder in straight away and swaps it for the image when the
   * upload lands. The placeholder is found by its id rather than by position,
   * because the document may well have moved on by then.
   */
  const insertImageFile = useCallback(
    (file: File) => {
      const upload = uploadImageRef.current;
      const editorInstance = editorRef.current;
      if (!upload || !editorInstance) return;

      const uploadId = crypto.randomUUID();
      editorInstance.chain().focus().insertUploadingImage(uploadId).run();

      void upload(file)
        .then((stored) => {
          const current = editorRef.current;
          if (!current) return;
          let found = false;
          current.state.doc.descendants((node, pos) => {
            if (found) return false;
            if (node.type.name === "canvasImage" && node.attrs.uploadId === uploadId) {
              found = true;
              const tr = current.state.tr;
              if (stored) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: stored.url,
                  attachmentId: stored.attachmentId,
                  uploadId: null,
                });
              } else {
                // Nothing to show and no way to retry — take the placeholder
                // out rather than leaving a permanent spinner.
                tr.delete(pos, pos + node.nodeSize);
              }
              current.view.dispatch(tr);
              return false;
            }
            return true;
          });
          void flush();
        })
        .catch(() => {
          const current = editorRef.current;
          if (!current) return;
          current.state.doc.descendants((node, pos) => {
            if (node.type.name === "canvasImage" && node.attrs.uploadId === uploadId) {
              current.view.dispatch(current.state.tr.delete(pos, pos + node.nodeSize));
              return false;
            }
            return true;
          });
        });
    },
    [flush],
  );

  const insertImageRef = useRef(insertImageFile);
  insertImageRef.current = insertImageFile;

  const handlePickImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) insertImageFile(file);
    };
    input.click();
  }, [insertImageFile]);

  const handleCreateDatabase = useCallback((preset: DatabasePreset) => {
    const create = createDatabaseRef.current;
    if (!create) return;
    void create(preset).then((databaseId) => {
      if (!databaseId) return;
      editorRef.current?.chain().focus().insertCanvasDatabase(databaseId).run();
      void flush();
    });
  }, [flush]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        heading: { levels: [1, 2, 3] },
      }),
      CodeBlockShiki.configure({ defaultTheme: "github-dark" }),
      TableKit.configure({
        table: { resizable: true, HTMLAttributes: { class: "canvas-table" } },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : "Write something, or press / for blocks",
      }),
      CanvasDatabaseNode,
      PageLinkNode,
      CanvasImageNode,
      CanvasSlashMenu.configure({
        onCreateDatabase: handleCreateDatabase,
        onCreatePage: onCreatePage ? handleCreatePage : null,
        onInsertImage: onUploadImage ? handlePickImage : null,
      }),
    ],
    [handleCreateDatabase, handleCreatePage, onCreatePage, handlePickImage, onUploadImage],
  );

  const editor = useEditor(
    {
      extensions,
      editable,
      content: initialContent ?? "",
      onCreate: ({ editor: e }) => {
        savedJsonRef.current = JSON.stringify(e.getJSON());
      },
      onUpdate: ({ editor: e }) => {
        scheduleSave(e.getJSON() as CanvasContent);
      },
      editorProps: {
        attributes: {
          class: "canvas-doc",
          "data-testid": "canvas-editor",
        },
        handlePaste: (_view, event) => {
          const files = imageFilesFrom(event.clipboardData);
          if (files.length === 0) return false;
          event.preventDefault();
          for (const file of files) insertImageRef.current(file);
          return true;
        },
        handleDrop: (_view, event) => {
          const files = imageFilesFrom((event as DragEvent).dataTransfer);
          if (files.length === 0) return false;
          event.preventDefault();
          for (const file of files) insertImageRef.current(file);
          return true;
        },
      },
    },
    // Rebuild when switching documents so content/history do not leak across tabs.
    [documentKey],
  );

  useEffect(() => {
    editorRef.current = editor;
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Flush anything pending when leaving the document.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush, documentKey]);

  // Persist before the tab closes.
  useEffect(() => {
    const handler = () => {
      if (pendingRef.current) void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  if (!editor) {
    return <div className="flex-1" data-testid="canvas-editor-loading" />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-save-state={saveState}>
      {editable && <CanvasToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-6">
          {editable && <CanvasBlockHandle editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
