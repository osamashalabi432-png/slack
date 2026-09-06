import { describe, test, expect, afterEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import { CanvasBottomToolbar } from "./CanvasBottomToolbar";
import { CanvasColumns, CanvasColumn } from "./canvas-columns";

vi.mock("../message/EmojiPicker", () => ({
  EmojiPicker: ({ onSelect }: { onSelect: (e: string) => void }) => (
    <button data-testid="mock-emoji" onClick={() => onSelect("🚀")}>
      pick
    </button>
  ),
}));

let editor: Editor;
afterEach(() => {
  editor?.destroy();
  cleanup();
});

function makeEditor(): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, TableKit, TaskList, TaskItem, CanvasColumns, CanvasColumn],
    content: "<p>hi</p>",
  });
}

function nodeCount(e: Editor, type: string): number {
  let n = 0;
  e.state.doc.descendants((node) => {
    if (node.type.name === type) n += 1;
  });
  return n;
}

describe("CanvasBottomToolbar", () => {
  test("renders the floating bar without an AI button", () => {
    editor = makeEditor();
    render(<CanvasBottomToolbar editor={editor} />);
    expect(screen.getByTestId("canvas-bottom-toolbar")).toBeDefined();
    expect(screen.getByTestId("canvas-tb-add")).toBeDefined();
    expect(screen.getByTestId("canvas-tb-format")).toBeDefined();
    expect(screen.queryByLabelText(/ai/i)).toBeNull();
    expect(screen.queryByLabelText(/sparkle/i)).toBeNull();
  });

  test("the table button inserts a table", () => {
    editor = makeEditor();
    render(<CanvasBottomToolbar editor={editor} />);
    expect(nodeCount(editor, "table")).toBe(0);
    fireEvent.click(screen.getByTestId("canvas-tb-table"));
    expect(nodeCount(editor, "table")).toBe(1);
  });

  test("the layouts button inserts a 2-column layout", () => {
    editor = makeEditor();
    render(<CanvasBottomToolbar editor={editor} />);
    fireEvent.click(screen.getByTestId("canvas-tb-layouts"));
    expect(nodeCount(editor, "columnList")).toBe(1);
    expect(nodeCount(editor, "column")).toBe(2);
  });

  test("the checklist button toggles a task list", () => {
    editor = makeEditor();
    render(<CanvasBottomToolbar editor={editor} />);
    fireEvent.click(screen.getByTestId("canvas-tb-checklist"));
    expect(editor.isActive("taskList")).toBe(true);
  });

  test("the emoji button inserts the picked emoji", async () => {
    editor = makeEditor();
    render(<CanvasBottomToolbar editor={editor} />);
    fireEvent.click(screen.getByTestId("canvas-tb-emoji"));
    fireEvent.click(await screen.findByTestId("mock-emoji"));
    expect(editor.getText()).toContain("🚀");
  });

  test("the + button calls onPickImage / onCreatePage when provided", async () => {
    const onPickImage = vi.fn();
    const onCreatePage = vi.fn();
    editor = makeEditor();
    render(
      <CanvasBottomToolbar editor={editor} onPickImage={onPickImage} onCreatePage={onCreatePage} />,
    );
    fireEvent.pointerDown(screen.getByTestId("canvas-tb-add"), { button: 0, pointerType: "mouse" });
    fireEvent.click(await screen.findByText("Image"));
    expect(onPickImage).toHaveBeenCalled();
  });
});
