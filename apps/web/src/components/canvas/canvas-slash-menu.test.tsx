import { describe, test, expect, afterEach, vi } from "vitest";
import type { Editor, Range } from "@tiptap/core";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import {
  CANVAS_BLOCKS,
  filterCanvasBlocks,
  pageBlockItem,
  CanvasSlashList,
} from "./canvas-slash-menu";

const noop = () => {};

describe("filterCanvasBlocks", () => {
  test("returns every block for an empty query", () => {
    expect(filterCanvasBlocks("")).toHaveLength(CANVAS_BLOCKS.length);
    expect(filterCanvasBlocks("   ")).toHaveLength(CANVAS_BLOCKS.length);
  });

  test("matches on title, case-insensitively", () => {
    const ids = filterCanvasBlocks("HEAD").map((b) => b.id);
    expect(ids).toContain("h1");
    expect(ids).toContain("h2");
    expect(ids).toContain("h3");
  });

  test("matches on keywords", () => {
    expect(filterCanvasBlocks("todo").map((b) => b.id)).toContain("todo");
    expect(filterCanvasBlocks("checkbox").map((b) => b.id)).toContain("todo");
    expect(filterCanvasBlocks("hr").map((b) => b.id)).toContain("divider");
  });

  test("returns nothing for a query that matches no block", () => {
    expect(filterCanvasBlocks("zzzz")).toHaveLength(0);
  });

  test("every block has a distinct id", () => {
    const ids = CANVAS_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("ranks a title match above a keyword/description match", () => {
    // "/pa": Text matches only via its "paragraph" keyword; Page matches its
    // title. Page must come first.
    const ids = filterCanvasBlocks("pa", [pageBlockItem(noop)]).map((b) => b.id);
    expect(ids[0]).toBe("page");
    expect(ids).toContain("text");
    expect(ids.indexOf("page")).toBeLessThan(ids.indexOf("text"));
  });

  test("prefers a title prefix over a title substring", () => {
    // "code" is the title of the code block; nothing else starts with it.
    expect(filterCanvasBlocks("code")[0]?.id).toBe("code");
  });

  test("keeps the original menu order within the same rank", () => {
    // Both headings match "heading" by keyword-prefix at the same rank.
    const ids = filterCanvasBlocks("heading").map((b) => b.id);
    expect(ids.indexOf("h1")).toBeLessThan(ids.indexOf("h2"));
    expect(ids.indexOf("h2")).toBeLessThan(ids.indexOf("h3"));
  });
});

describe("the plain table block", () => {
  test("clears the slash query, then drops in a 3x3 table with a header row", () => {
    const block = CANVAS_BLOCKS.find((b) => b.id === "table");
    expect(block).toBeDefined();

    const run = vi.fn();
    const insertTable = vi.fn(() => ({ run }));
    const deleteRange = vi.fn(() => ({ insertTable }));
    const focus = vi.fn(() => ({ deleteRange }));
    const editor = { chain: () => ({ focus }) } as unknown as Editor;
    const range = { from: 0, to: 6 } as Range;

    block!.run(editor, range);

    expect(deleteRange).toHaveBeenCalledWith(range);
    expect(insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
    expect(run).toHaveBeenCalledOnce();
  });

  test("is reachable by its spreadsheet-ish keywords", () => {
    expect(filterCanvasBlocks("grid").map((b) => b.id)).toContain("table");
    expect(filterCanvasBlocks("spreadsheet").map((b) => b.id)).toContain("table");
  });
});

describe("CanvasSlashList", () => {
  afterEach(cleanup);

  test("renders one entry per block", () => {
    render(<CanvasSlashList items={CANVAS_BLOCKS} command={() => {}} />);
    expect(screen.getByTestId("canvas-slash-menu")).toBeTruthy();
    for (const block of CANVAS_BLOCKS) {
      expect(screen.getByTestId(`canvas-block-${block.id}`)).toBeTruthy();
    }
  });

  test("clicking a block runs its command", () => {
    const command = vi.fn();
    render(<CanvasSlashList items={CANVAS_BLOCKS} command={command} />);

    fireEvent.mouseDown(screen.getByTestId("canvas-block-todo"));
    expect(command).toHaveBeenCalledOnce();
    expect(command.mock.calls[0]![0]).toMatchObject({ id: "todo" });
  });

  test("shows an empty state when nothing matches", () => {
    render(<CanvasSlashList items={[]} command={() => {}} />);
    expect(screen.getByText("No blocks found")).toBeTruthy();
    expect(screen.queryByTestId("canvas-slash-menu")).toBeNull();
  });
});
