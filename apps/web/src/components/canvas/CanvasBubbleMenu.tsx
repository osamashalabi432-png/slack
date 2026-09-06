import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import clsx from "clsx";
import { Bold, Italic, Underline, Strikethrough, Code, Link2 } from "lucide-react";

/**
 * Inline formatting on a text selection (the persistent B/I/U/S row moved to
 * this floating bubble when the toolbar went to the bottom).
 */
export function CanvasBubbleMenu({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    clsx(
      "w-7 h-7 flex items-center justify-center rounded border-none bg-transparent cursor-pointer transition-colors",
      active ? "bg-surface-selected text-slaq-blue" : "text-secondary hover:bg-surface-hover",
    );

  const setLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      // Only for plain text runs — not inside tables/code/images where it gets in the way.
      shouldShow={({ editor: e, from, to }) =>
        from !== to && !e.isActive("codeBlock") && !e.isActive("canvasImage") && e.isEditable
      }
      options={{ placement: "top", offset: 8 }}
    >
      <div
        data-testid="canvas-bubble-menu"
        className="flex items-center gap-0.5 rounded-lg border border-border-default bg-surface px-1 py-1 shadow-lg"
      >
        <button type="button" aria-label="Bold" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Italic" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Underline" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Strikethrough" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border-default mx-0.5" />
        <button type="button" aria-label="Inline code" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Link" className={btn(editor.isActive("link"))} onClick={setLink}>
          <Link2 className="w-4 h-4" />
        </button>
      </div>
    </BubbleMenu>
  );
}
