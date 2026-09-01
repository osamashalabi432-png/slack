import { describe, test, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import {
  type BlockTarget,
  insertBlockBelow,
  duplicateBlock,
  deleteBlock,
  moveBlock,
  turnBlockInto,
} from "./canvas-block-ops";

function makeEditor(html: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: html,
  });
}

function targetAt(editor: Editor, index: number): BlockTarget {
  let found: BlockTarget | null = null;
  let seen = 0;
  editor.state.doc.forEach((node, offset) => {
    if (seen === index) found = { node, pos: offset };
    seen += 1;
  });
  if (!found) throw new Error(`no top-level block at index ${index}`);
  return found;
}

const lines = (editor: Editor) => editor.getText({ blockSeparator: "\n" });

let editor: Editor;
afterEach(() => editor?.destroy());

describe("moveBlock", () => {
  test("moves a block up past its previous sibling", () => {
    editor = makeEditor("<p>one</p><p>two</p><p>three</p>");
    expect(moveBlock(editor, targetAt(editor, 1), "up")).toBe(true);
    expect(lines(editor)).toBe("two\none\nthree");
  });

  test("moves a block down past its next sibling", () => {
    editor = makeEditor("<p>one</p><p>two</p><p>three</p>");
    expect(moveBlock(editor, targetAt(editor, 1), "down")).toBe(true);
    expect(lines(editor)).toBe("one\nthree\ntwo");
  });

  test("is a no-op at the edges", () => {
    editor = makeEditor("<p>one</p><p>two</p>");
    expect(moveBlock(editor, targetAt(editor, 0), "up")).toBe(false);
    expect(moveBlock(editor, targetAt(editor, 1), "down")).toBe(false);
    expect(lines(editor)).toBe("one\ntwo");
  });
});

describe("duplicateBlock / deleteBlock", () => {
  test("duplicate drops an identical block right after", () => {
    editor = makeEditor("<p>one</p><p>two</p><p>three</p>");
    duplicateBlock(editor, targetAt(editor, 1));
    expect(editor.state.doc.childCount).toBe(4);
    expect(lines(editor)).toBe("one\ntwo\ntwo\nthree");
  });

  test("delete removes the block", () => {
    editor = makeEditor("<p>one</p><p>two</p><p>three</p>");
    deleteBlock(editor, targetAt(editor, 1));
    expect(editor.state.doc.childCount).toBe(2);
    expect(lines(editor)).toBe("one\nthree");
  });
});

describe("insertBlockBelow", () => {
  test("inserts an empty paragraph directly under the target", () => {
    editor = makeEditor("<p>one</p><p>two</p>");
    insertBlockBelow(editor, targetAt(editor, 0));
    expect(editor.state.doc.childCount).toBe(3);
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
    expect(editor.state.doc.child(1).textContent).toBe("");
    expect(editor.state.doc.child(2).textContent).toBe("two");
  });
});

describe("turnBlockInto", () => {
  test("converts a paragraph to a heading of the requested level", () => {
    editor = makeEditor("<p>title</p><p>body</p>");
    turnBlockInto(editor, targetAt(editor, 0), "h2");
    expect(editor.state.doc.child(0).type.name).toBe("heading");
    expect(editor.state.doc.child(0).attrs.level).toBe(2);
    expect(editor.state.doc.child(0).textContent).toBe("title");
  });

  test("wraps a paragraph into a bulleted list", () => {
    editor = makeEditor("<p>item</p>");
    turnBlockInto(editor, targetAt(editor, 0), "bulletList");
    expect(editor.state.doc.child(0).type.name).toBe("bulletList");
    expect(editor.state.doc.child(0).textContent).toBe("item");
  });

  test("wraps a paragraph into a to-do list", () => {
    editor = makeEditor("<p>task</p>");
    turnBlockInto(editor, targetAt(editor, 0), "taskList");
    expect(editor.state.doc.child(0).type.name).toBe("taskList");
  });
});
