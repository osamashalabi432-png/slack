import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { CodeBlockShiki } from "tiptap-extension-code-block-shiki";
import type { CanvasContent, DatabasePreset } from "@openslaq/shared";
import { useCanvasCollab } from "../../hooks/chat/useCanvasCollab";
import { renderCollabCaret } from "./collab-caret";
import { CanvasBlockHandle } from "./CanvasBlockHandle";
import { CanvasTableControls } from "./CanvasTableControls";
import { CanvasBottomToolbar } from "./CanvasBottomToolbar";
import { CanvasBubbleMenu } from "./CanvasBubbleMenu";
import { CanvasColumns, CanvasColumn } from "./canvas-columns";
import { CanvasSlashMenu } from "./canvas-slash-menu";
import { CanvasDatabaseNode } from "./CanvasDatabaseNode";
import { PageLinkNode } from "./PageLinkNode";
import { CanvasImageNode } from "./CanvasImageNode";
import type { UploadedImage } from "../../hooks/useImageStore";
import "./canvas.css";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 900;

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
  /**
   * The signed-in user, for real-time co-editing. When present the canvas joins
   * a collaboration room and shows everyone's cursor + a gutter avatar.
   */
  collabUser?: { id: string; name: string; color: string; avatarUrl?: string | null } | null;
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
  collabUser = null,
}: CanvasEditorProps) {
  const collabEnabled = Boolean(collabUser) && editable;
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
  // The scrolling document viewport — the bottom toolbar is pinned to its
  // bottom edge and centred on its width, so it never drifts as the caret moves.
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the shared Yjs doc from the saved body — only the client the relay
  // designates, and only while the doc is still empty, so it can't duplicate.
  const seedCollabDoc = useCallback((content: CanvasContent | null) => {
    const e = editorRef.current;
    if (e && content && e.isEmpty) {
      e.commands.setContent(content, { emitUpdate: true });
    }
  }, []);

  const collab = useCanvasCollab({
    enabled: collabEnabled,
    pageId: documentKey,
    initialContent,
    onSeed: seedCollabDoc,
  });

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
        // Collaboration ships its own shared-history; the built-in one would
        // clash with it.
        undoRedo: collabEnabled ? false : undefined,
      }),
      ...(collabEnabled
        ? [
            Collaboration.configure({ document: collab.ydoc }),
            CollaborationCaret.configure({
              provider: { awareness: collab.awareness },
              user: collabUser ?? {},
              render: renderCollabCaret,
            }),
          ]
        : []),
      CodeBlockShiki.configure({ defaultTheme: "github-dark" }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 48,
          // Resizing the last column shouldn't grow the whole table past its
          // container — keeps the layout (and the hover "+" affordance) stable.
          lastColumnResizable: false,
          HTMLAttributes: { class: "canvas-table" },
        },
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
      CanvasColumns,
      CanvasColumn,
      CanvasSlashMenu.configure({
        onCreateDatabase: handleCreateDatabase,
        onCreatePage: onCreatePage ? handleCreatePage : null,
        onInsertImage: onUploadImage ? handlePickImage : null,
      }),
    ],
    [
      handleCreateDatabase,
      handleCreatePage,
      onCreatePage,
      handlePickImage,
      onUploadImage,
      collabEnabled,
      collab.ydoc,
      collab.awareness,
      collabUser,
    ],
  );

  const editor = useEditor(
    {
      extensions,
      editable,
      // In collab mode the shared Yjs doc is the source of truth — the seeding
      // client loads `initialContent` into it once (see seedCollabDoc).
      content: collabEnabled ? undefined : (initialContent ?? ""),
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
    // Rebuild when switching documents (so content/history don't leak across
    // tabs) or when collaboration turns on/off.
    [documentKey, collabEnabled],
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Extra bottom room so the floating toolbar never covers the last line. */}
        <div className="w-full px-8 pt-6 pb-28">
          {editable && <CanvasBlockHandle editor={editor} />}
          {editable && <CanvasTableControls editor={editor} />}
          {editable && <CanvasBubbleMenu editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
      {editable && (
        <CanvasBottomToolbar
          editor={editor}
          containerRef={scrollRef}
          onPickImage={onUploadImage ? handlePickImage : undefined}
          onCreatePage={onCreatePage ? handleCreatePage : undefined}
        />
      )}
    </div>
  );
}
