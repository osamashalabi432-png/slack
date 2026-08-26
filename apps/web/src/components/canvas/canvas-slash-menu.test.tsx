import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import {
  CANVAS_BLOCKS,
  filterCanvasBlocks,
  CanvasSlashList,
} from "./canvas-slash-menu";

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
