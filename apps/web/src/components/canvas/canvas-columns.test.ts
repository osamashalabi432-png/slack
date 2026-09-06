import { describe, test, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CanvasColumns, CanvasColumn } from "./canvas-columns";

let editor: Editor;
afterEach(() => editor?.destroy());

function count(e: Editor, type: string): number {
  let n = 0;
  e.state.doc.descendants((node) => {
    if (node.type.name === type) n += 1;
  });
  return n;
}

describe("canvas columns", () => {
  test("insertColumns drops a columnList with the requested number of columns", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, CanvasColumns, CanvasColumn],
      content: "<p></p>",
    });

    editor.chain().focus().insertColumns(2).run();
    expect(count(editor, "columnList")).toBe(1);
    expect(count(editor, "column")).toBe(2);

    editor.chain().focus().insertColumns(3).run();
    expect(count(editor, "columnList")).toBe(2);
    expect(count(editor, "column")).toBe(5);
  });

  test("each fresh column starts with an empty paragraph", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, CanvasColumns, CanvasColumn],
      content: "<p></p>",
    });
    editor.chain().focus().insertColumns(2).run();
    editor.state.doc.descendants((node) => {
      if (node.type.name === "column") {
        expect(node.firstChild?.type.name).toBe("paragraph");
      }
    });
  });
});
