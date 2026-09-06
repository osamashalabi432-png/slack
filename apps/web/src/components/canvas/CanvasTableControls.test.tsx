import { describe, test, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { CellSelection } from "@tiptap/pm/tables";
import { fireEvent } from "@testing-library/react";
import { render, screen, cleanup } from "../../test-utils";
import { CanvasTableControls } from "./CanvasTableControls";

function makeEditor(content: string): Editor {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, TableKit],
    content,
  });
}

function count(editor: Editor, typeName: string): number {
  let n = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === typeName) n += 1;
  });
  return n;
}

let editor: Editor;
afterEach(() => {
  editor?.destroy();
  cleanup();
});

describe("CanvasTableControls", () => {
  test("renders nothing while the selection is not in a table", () => {
    editor = makeEditor("<p>plain text</p>");
    render(<CanvasTableControls editor={editor} />);
    expect(screen.queryByTestId("canvas-table-controls")).toBeNull();
  });

  test('the "+" buttons append a row / a column to the table', async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    const addRow = await screen.findByTestId("canvas-table-add-row");
    const addCol = await screen.findByTestId("canvas-table-add-column");
    const delRow = await screen.findByTestId("canvas-table-remove-row");
    const delCol = await screen.findByTestId("canvas-table-remove-column");

    expect(count(editor, "tableRow")).toBe(2);
    expect(count(editor, "tableCell")).toBe(4);

    fireEvent.mouseDown(addRow);
    expect(count(editor, "tableRow")).toBe(3);
    expect(count(editor, "tableCell")).toBe(6);

    fireEvent.mouseDown(addCol);
    expect(count(editor, "tableCell")).toBe(9);

    fireEvent.mouseDown(delRow);
    expect(count(editor, "tableRow")).toBe(2);
    expect(count(editor, "tableCell")).toBe(6);

    fireEvent.mouseDown(delCol);
    expect(count(editor, "tableCell")).toBe(4);
  });

  test("never deletes the last row or column", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    const delRow = await screen.findByTestId("canvas-table-remove-row");
    const delCol = await screen.findByTestId("canvas-table-remove-column");
    fireEvent.mouseDown(delRow);
    fireEvent.mouseDown(delCol);

    expect(count(editor, "tableRow")).toBe(1);
    expect(count(editor, "tableCell")).toBe(1);
  });

  test("renders a grip per row, a grip per column, and a corner handle", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    expect(await screen.findByTestId("canvas-table-row-grip-0")).toBeDefined();
    expect(screen.getByTestId("canvas-table-row-grip-2")).toBeDefined();
    expect(screen.queryByTestId("canvas-table-row-grip-3")).toBeNull();
    expect(screen.getByTestId("canvas-table-col-grip-0")).toBeDefined();
    expect(screen.getByTestId("canvas-table-col-grip-1")).toBeDefined();
    expect(screen.queryByTestId("canvas-table-col-grip-2")).toBeNull();
    expect(screen.getByTestId("canvas-table-select-all")).toBeDefined();
  });

  test("only the pointed-at row/column grip is marked hot", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    await screen.findByTestId("canvas-table-row-grip-0");
    for (const id of ["canvas-table-row-grip-0", "canvas-table-col-grip-0"]) {
      expect(screen.getByTestId(id).getAttribute("data-hot")).toBe("false");
    }

    // happy-dom rects are all zero, so a pointer at the origin lines up with
    // the first row and first column only.
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });

    expect(screen.getByTestId("canvas-table-row-grip-0").getAttribute("data-hot")).toBe("true");
    expect(screen.getByTestId("canvas-table-col-grip-0").getAttribute("data-hot")).toBe("true");
    expect(screen.getByTestId("canvas-table-row-grip-1").getAttribute("data-hot")).toBe("false");
    expect(screen.getByTestId("canvas-table-col-grip-1").getAttribute("data-hot")).toBe("false");
  });

  test("a row grip opens the row menu; Insert row below / Delete row act on that row", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    fireEvent.click(await screen.findByTestId("canvas-table-row-grip-0"));
    fireEvent.click(await screen.findByText("Insert row below"));
    expect(count(editor, "tableRow")).toBe(3);

    fireEvent.click(screen.getByTestId("canvas-table-row-grip-0"));
    fireEvent.click(await screen.findByText("Delete row"));
    expect(count(editor, "tableRow")).toBe(2);
  });

  test("a column grip opens the column menu; Insert column right / Delete column act on it", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    fireEvent.click(await screen.findByTestId("canvas-table-col-grip-0"));
    fireEvent.click(await screen.findByText("Insert column right"));
    expect(count(editor, "tableCell")).toBe(6);

    fireEvent.click(screen.getByTestId("canvas-table-col-grip-0"));
    fireEvent.click(await screen.findByText("Delete column"));
    expect(count(editor, "tableCell")).toBe(4);
  });

  test("Clear contents empties the selected row's cells but keeps the row", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    editor.chain().focus().insertContent("keepme").run();
    expect(editor.getText()).toContain("keepme");
    render(<CanvasTableControls editor={editor} />);

    fireEvent.click(await screen.findByTestId("canvas-table-row-grip-0"));
    fireEvent.click(await screen.findByText("Clear contents"));

    expect(editor.getText()).not.toContain("keepme");
    expect(count(editor, "tableRow")).toBe(2);
    expect(count(editor, "tableCell")).toBe(4);
  });

  test("controls stay dormant until the pointer is near the table", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    const controls = await screen.findByTestId("canvas-table-controls");
    expect(controls.getAttribute("data-active")).toBe("false");
  });

  test("a grip highlights its row while the menu is open, then clears on dismiss", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    fireEvent.click(await screen.findByTestId("canvas-table-row-grip-0"));
    await screen.findByText("Insert row above");
    expect(editor.state.selection instanceof CellSelection).toBe(true);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(editor.state.selection instanceof CellSelection).toBe(false);
  });

  test("the corner handle opens a table menu that can delete the whole table", async () => {
    editor = makeEditor("<p></p>");
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    render(<CanvasTableControls editor={editor} />);

    fireEvent.click(await screen.findByTestId("canvas-table-select-all"));
    fireEvent.click(await screen.findByText("Delete table"));
    expect(count(editor, "table")).toBe(0);
  });
});
