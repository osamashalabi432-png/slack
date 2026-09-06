import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  TableMap,
  CellSelection,
  addRow,
  addColumn,
  removeRow,
  removeColumn,
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  mergeCells,
  splitCell,
} from "@tiptap/pm/tables";
import {
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Combine,
  SplitSquareHorizontal,
  Eraser,
  Trash2,
} from "lucide-react";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Metrics {
  /** The `<table>` box, in viewport (fixed) coordinates. */
  table: Rect;
  /** Per-row top / height, viewport coordinates. */
  rows: { top: number; height: number }[];
  /** Per-column left / width (from the first row), viewport coordinates. */
  cols: { left: number; width: number }[];
}

type TableOp = "row-add" | "row-del" | "col-add" | "col-del";
type MenuTarget = { kind: "row" | "col" | "table"; index: number };

/** Width / height of the grip strips and the corner handle. */
const GRIP = 14;
/** Gap between the grip and the table edge — flush, so it reads as the border. */
const GAP = 0;

type PMCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

/** Walk out from the selection to the enclosing table node. */
function tableAtSelection(editor: Editor): { table: PMNode; start: number; pos: number } | null {
  const $from = editor.state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.spec.tableRole === "table") {
      const pos = $from.before(depth);
      return { table: node, start: pos + 1, pos };
    }
  }
  return null;
}

/** The `<table>` DOM element the selection is inside, for on-screen positioning. */
function tableDom(editor: Editor): HTMLTableElement | null {
  const found = tableAtSelection(editor);
  if (!found) return null;
  const dom = editor.view.nodeDOM(found.pos);
  const el = dom instanceof HTMLElement ? dom : null;
  return (el?.querySelector("table") as HTMLTableElement | null) ?? el?.closest("table") ?? null;
}

function measure(dom: HTMLTableElement): Metrics {
  const b = dom.getBoundingClientRect();
  const rows = Array.from(dom.rows).map((tr) => {
    const r = tr.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
  const first = dom.rows[0];
  const cols = first
    ? Array.from(first.cells).map((cell) => {
        const r = cell.getBoundingClientRect();
        return { left: r.left, width: r.width };
      })
    : [];
  return {
    table: { top: b.top, left: b.left, width: b.width, height: b.height },
    rows,
    cols,
  };
}

/**
 * Notion-style table affordances for the plain `/table` block:
 *
 *  - `+` / `−` down the right edge (add / remove the last column) and across the
 *    bottom edge (add / remove the last row).
 *  - A grip strip down the left of every row and across the top of every column;
 *    clicking one selects that whole row / column and opens a context menu
 *    (insert before / after, merge, split, clear contents, delete).
 *  - A corner handle that selects the whole table.
 *
 * Everything tracks the table's on-screen box and acts through direct
 * ProseMirror transactions, so a click always lands regardless of where the
 * caret is.
 */
export function CanvasTableControls({ editor }: { editor: Editor }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  // The edge +/- clusters only show while the pointer is actually over the
  // table (or the clusters themselves). The row/column grips are always live
  // click targets on the borders — invisible until you hover one.
  const [overTable, setOverTable] = useState(false);
  // The single row / column the pointer currently lines up with — only those
  // two grip nubs are painted, never the whole rail.
  const [hot, setHot] = useState<{ row: number | null; col: number | null }>({
    row: null,
    col: null,
  });
  // Last table the caret was in — the controls keep working even after a click
  // moves focus out of the editor.
  const lastStart = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = tableAtSelection(editor);
        if (found) lastStart.current = found.start;

        const dom = tableDom(editor);
        if (!dom) {
          setMetrics(null);
          setMenu(null);
          return;
        }
        const next = measure(dom);
        setMetrics((prev) =>
          prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
      });
    };

    remeasure();
    editor.on("transaction", remeasure);
    editor.on("selectionUpdate", remeasure);
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", remeasure);
      editor.off("selectionUpdate", remeasure);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [editor]);

  // Show the edge +/- only while the pointer is over the table body or the
  // narrow strip on its right / bottom where those buttons sit. Deliberately
  // tight on the top/left so it never feels like permanent chrome.
  useEffect(() => {
    if (!metrics) {
      setOverTable(false);
      setHot({ row: null, col: null });
      return;
    }
    const { table, rows, cols } = metrics;
    const onMove = (e: PointerEvent) => {
      const near =
        // Left / top: only as far out as the grip nubs, so it isn't chrome.
        e.clientX >= table.left - GRIP - 6 &&
        e.clientX <= table.left + table.width + 34 &&
        e.clientY >= table.top - GRIP - 6 &&
        e.clientY <= table.top + table.height + 34;
      setOverTable(near);

      if (!near) {
        setHot({ row: null, col: null });
        return;
      }
      // Which row / column does the pointer line up with? (null when it's out
      // past an edge — e.g. hovering the row nub itself has no column.)
      const row = rows.findIndex((r) => e.clientY >= r.top && e.clientY <= r.top + r.height);
      const col = cols.findIndex((c) => e.clientX >= c.left && e.clientX <= c.left + c.width);
      setHot((prev) => {
        const next = { row: row === -1 ? null : row, col: col === -1 ? null : col };
        return prev.row === next.row && prev.col === next.col ? prev : next;
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [metrics]);

  /** Collapse a lingering CellSelection back to a caret, so nothing stays shaded. */
  const collapseCellSelection = () => {
    const { state } = editor.view;
    if (!(state.selection instanceof CellSelection)) return;
    const at = Math.min(state.selection.$headCell.pos + 1, state.doc.content.size);
    editor.view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(at))));
  };

  /** Resolve the tracked table plus its current map. */
  const tableInfo = () => {
    const start = lastStart.current;
    if (start === null) return null;
    const { doc } = editor.view.state;
    const table = doc.nodeAt(start - 1);
    if (!table || table.type.spec.tableRole !== "table") return null;
    return { start, table, map: TableMap.get(table), doc };
  };

  /** Put a CellSelection over a whole row / column / the whole table. */
  const selectSpan = (target: MenuTarget) => {
    const info = tableInfo();
    if (!info) return;
    const { start, map, doc } = info;
    const cells = map.map;
    let sel: CellSelection;
    if (target.kind === "row") {
      if (target.index < 0 || target.index >= map.height) return;
      const cell = cells[target.index * map.width];
      if (cell === undefined) return;
      sel = CellSelection.rowSelection(doc.resolve(start + cell));
    } else if (target.kind === "col") {
      if (target.index < 0 || target.index >= map.width) return;
      const cell = cells[target.index];
      if (cell === undefined) return;
      sel = CellSelection.colSelection(doc.resolve(start + cell));
    } else {
      const first = cells[0];
      const last = cells[cells.length - 1];
      if (first === undefined || last === undefined) return;
      sel = CellSelection.create(doc, start + first, start + last);
    }
    editor.view.dispatch(editor.view.state.tr.setSelection(sel).scrollIntoView());
    editor.view.focus();
  };

  const openMenu = (target: MenuTarget) => {
    selectSpan(target);
    setMenu(target);
  };

  /** Run a raw prosemirror-tables command against the live selection. */
  const cmd = (fn: PMCommand) => () => {
    fn(editor.view.state, editor.view.dispatch);
    editor.view.focus();
    setMenu(null);
  };

  /** Replace every selected cell's body with an empty paragraph. */
  const clearContents = () => {
    const state = editor.view.state;
    const sel = state.selection;
    if (!(sel instanceof CellSelection)) return;
    const paragraph = state.schema.nodes.paragraph;
    if (!paragraph) return;
    const ranges: [number, number][] = [];
    sel.forEachCell((cell, pos) => {
      // An empty cell already holds just one empty paragraph (content size 2).
      if (cell.content.size > 2) ranges.push([pos + 1, pos + cell.nodeSize - 1]);
    });
    if (ranges.length === 0) {
      setMenu(null);
      return;
    }
    const tr = state.tr;
    // Back-to-front so earlier replacements don't shift later positions.
    for (const [from, to] of ranges.reverse()) {
      const filled = paragraph.createAndFill();
      if (filled) tr.replaceWith(from, to, filled);
    }
    if (tr.docChanged) editor.view.dispatch(tr);
    editor.view.focus();
    setMenu(null);
  };

  // Direct-transaction add / remove for the edge +/- buttons (no caret needed).
  const run = (op: TableOp) => {
    const start = lastStart.current;
    if (start === null) return;
    const { state } = editor.view;
    const table = state.doc.nodeAt(start - 1);
    if (!table || table.type.spec.tableRole !== "table") return;

    const map = TableMap.get(table);
    const rectArg = {
      map,
      table,
      tableStart: start,
      left: 0,
      top: 0,
      right: map.width,
      bottom: map.height,
    };

    const tr = state.tr;
    switch (op) {
      case "row-add":
        addRow(tr, rectArg, map.height);
        break;
      case "col-add":
        addColumn(tr, rectArg, map.width);
        break;
      case "row-del":
        if (map.height <= 1) return; // never delete the last row
        removeRow(tr, rectArg, map.height - 1);
        break;
      case "col-del":
        if (map.width <= 1) return;
        removeColumn(tr, rectArg, map.width - 1);
        break;
    }
    if (!tr.docChanged) return;
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };

  if (!metrics) return null;
  const { table } = metrics;

  const btn =
    "pointer-events-auto flex items-center justify-center text-secondary bg-surface border " +
    "border-border-default cursor-pointer transition-colors hover:bg-slaq-blue hover:text-white " +
    "hover:border-slaq-blue";

  const press = (op: TableOp) => (e: React.MouseEvent) => {
    e.preventDefault();
    run(op);
  };

  const state = editor.view.state;
  const canMerge = mergeCells(state);
  const canSplit = splitCell(state);

  const menuItem = "flex items-center gap-2.5 text-[13px]";

  // Where the (invisible) menu trigger sits, in viewport coordinates.
  let anchor: Rect | null = null;
  const menuRow = menu?.kind === "row" ? metrics.rows[menu.index] : undefined;
  const menuCol = menu?.kind === "col" ? metrics.cols[menu.index] : undefined;
  if (menuRow) {
    anchor = {
      top: menuRow.top,
      left: table.left - GRIP - GAP,
      width: GRIP,
      height: menuRow.height,
    };
  } else if (menuCol) {
    anchor = { top: table.top - GRIP - GAP, left: menuCol.left, width: menuCol.width, height: GRIP };
  } else if (menu?.kind === "table") {
    anchor = {
      top: table.top - GRIP - GAP,
      left: table.left - GRIP - GAP,
      width: GRIP,
      height: GRIP,
    };
  }

  return createPortal(
    <div
      data-testid="canvas-table-controls"
      data-active={overTable || menu !== null ? "true" : "false"}
      className="pointer-events-none fixed z-40"
      style={{ top: table.top, left: table.left, width: table.width, height: table.height }}
    >
      {/* Row grips — left edge */}
      {metrics.rows.map((r, i) => (
        <button
          key={`row-grip-${i}`}
          type="button"
          tabIndex={-1}
          aria-label={`Select row ${i + 1}`}
          data-testid={`canvas-table-row-grip-${i}`}
          data-axis="row"
          data-hot={
            hot.row === i || (menu?.kind === "row" && menu.index === i) ? "true" : "false"
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openMenu({ kind: "row", index: i })}
          className="canvas-table-grip pointer-events-auto absolute"
          style={{ top: r.top - table.top, left: -GRIP - GAP, width: GRIP, height: r.height }}
        />
      ))}

      {/* Column grips — top edge */}
      {metrics.cols.map((c, i) => (
        <button
          key={`col-grip-${i}`}
          type="button"
          tabIndex={-1}
          aria-label={`Select column ${i + 1}`}
          data-testid={`canvas-table-col-grip-${i}`}
          data-axis="col"
          data-hot={
            hot.col === i || (menu?.kind === "col" && menu.index === i) ? "true" : "false"
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openMenu({ kind: "col", index: i })}
          className="canvas-table-grip pointer-events-auto absolute"
          style={{ left: c.left - table.left, top: -GRIP - GAP, width: c.width, height: GRIP }}
        />
      ))}

      {/* Corner handle — select the whole table */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Select table"
        data-testid="canvas-table-select-all"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => openMenu({ kind: "table", index: -1 })}
        className="canvas-table-grip canvas-table-grip--corner pointer-events-auto absolute"
        style={{ left: -GRIP - GAP, top: -GRIP - GAP, width: GRIP, height: GRIP }}
      />

      {/* Right edge — columns */}
      <div className="canvas-table-edge pointer-events-none absolute top-1/2 -right-7 flex -translate-y-1/2 flex-col overflow-hidden rounded-md shadow-sm">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Add column"
          title="Insert column"
          data-testid="canvas-table-add-column"
          onMouseDown={press("col-add")}
          className={`${btn} h-6 w-6 rounded-b-none`}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Remove column"
          title="Remove last column"
          data-testid="canvas-table-remove-column"
          onMouseDown={press("col-del")}
          className={`${btn} h-6 w-6 rounded-t-none border-t-0`}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom edge — rows */}
      <div className="canvas-table-edge pointer-events-none absolute left-1/2 -bottom-7 flex -translate-x-1/2 overflow-hidden rounded-md shadow-sm">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Add row"
          title="Insert row"
          data-testid="canvas-table-add-row"
          onMouseDown={press("row-add")}
          className={`${btn} h-6 w-6 rounded-r-none`}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Remove row"
          title="Remove last row"
          data-testid="canvas-table-remove-row"
          onMouseDown={press("row-del")}
          className={`${btn} h-6 w-6 rounded-l-none border-l-0`}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Context menu for the selected row / column / table */}
      {anchor && (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) {
              setMenu(null);
              collapseCellSelection();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <span
              aria-hidden
              className="pointer-events-none fixed"
              style={{
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                height: anchor.height,
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={menu?.kind === "row" ? "right" : "bottom"}
            align="start"
            className="min-w-[200px]"
            data-testid="canvas-table-menu"
          >
            {menu?.kind === "row" && (
              <>
                <DropdownMenuItem className={menuItem} onSelect={cmd(addRowBefore)}>
                  <ArrowUp className="h-4 w-4" /> Insert row above
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={cmd(addRowAfter)}>
                  <ArrowDown className="h-4 w-4" /> Insert row below
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={menuItem}
                  disabled={!canMerge}
                  onSelect={cmd(mergeCells)}
                >
                  <Combine className="h-4 w-4" /> Merge selection
                </DropdownMenuItem>
                {canSplit && (
                  <DropdownMenuItem className={menuItem} onSelect={cmd(splitCell)}>
                    <SplitSquareHorizontal className="h-4 w-4" /> Split cell
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={menuItem} onSelect={clearContents}>
                  <Eraser className="h-4 w-4" /> Clear contents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={`${menuItem} text-danger-text`}
                  onSelect={cmd(deleteRow)}
                >
                  <Trash2 className="h-4 w-4" /> Delete row
                </DropdownMenuItem>
              </>
            )}

            {menu?.kind === "col" && (
              <>
                <DropdownMenuItem className={menuItem} onSelect={cmd(addColumnBefore)}>
                  <ArrowLeft className="h-4 w-4" /> Insert column left
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={cmd(addColumnAfter)}>
                  <ArrowRight className="h-4 w-4" /> Insert column right
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={menuItem}
                  disabled={!canMerge}
                  onSelect={cmd(mergeCells)}
                >
                  <Combine className="h-4 w-4" /> Merge selection
                </DropdownMenuItem>
                {canSplit && (
                  <DropdownMenuItem className={menuItem} onSelect={cmd(splitCell)}>
                    <SplitSquareHorizontal className="h-4 w-4" /> Split cell
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={menuItem} onSelect={clearContents}>
                  <Eraser className="h-4 w-4" /> Clear contents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={`${menuItem} text-danger-text`}
                  onSelect={cmd(deleteColumn)}
                >
                  <Trash2 className="h-4 w-4" /> Delete column
                </DropdownMenuItem>
              </>
            )}

            {menu?.kind === "table" && (
              <>
                <DropdownMenuItem className={menuItem} onSelect={clearContents}>
                  <Eraser className="h-4 w-4" /> Clear contents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={`${menuItem} text-danger-text`}
                  onSelect={cmd(deleteTable)}
                >
                  <Trash2 className="h-4 w-4" /> Delete table
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>,
    document.body,
  );
}
