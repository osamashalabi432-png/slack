import { describe, test, expect, vi, afterEach } from "vitest";
import type { CanvasDatabase, CanvasDatabaseRow, DbProperty, UserId, ChannelId } from "@openslaq/shared";
import { render, screen, within, cleanup } from "../../test-utils";
import { TableView } from "./TableView";

const properties: DbProperty[] = [
  { id: "title", name: "Name", type: "title" },
  {
    id: "status",
    name: "Status",
    type: "select",
    options: [
      { id: "todo", name: "To do", color: "gray" },
      { id: "doing", name: "Doing", color: "blue" },
    ],
  },
  { id: "due", name: "Due", type: "date" },
];

const database: CanvasDatabase = {
  id: "db-1",
  channelId: "chan-1" as ChannelId,
  tabId: null,
  name: "Tasks",
  properties,
  views: [{ id: "table", name: "Table", type: "table" }],
  createdBy: "user-1" as UserId,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeRow(id: string, values: CanvasDatabaseRow["values"]): CanvasDatabaseRow {
  return {
    id,
    databaseId: "db-1",
    position: 0,
    values,
    createdBy: "user-1" as UserId,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const rows = [
  makeRow("row-1", { title: "First", status: "todo" }),
  makeRow("row-2", { title: "Second", status: "doing" }),
];

function noop() {}

afterEach(cleanup);

describe("TableView", () => {
  test("renders a header cell for every property", () => {
    render(
      <TableView
        database={database}
        rows={rows}
        editable
        onSetValue={noop}
        onCreateRow={noop}
        onDeleteRow={noop}
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    // One per property; the trailing delete-column header is aria-hidden.
    expect(headers.map((h) => h.textContent)).toEqual(["Name", "Status", "Due"]);
  });

  test("renders one row per record with a cell per property", () => {
    render(
      <TableView
        database={database}
        rows={rows}
        editable
        onSetValue={noop}
        onCreateRow={noop}
        onDeleteRow={noop}
      />,
    );

    expect(screen.getByTestId("db-row-row-1")).toBeDefined();
    expect(screen.getByTestId("db-row-row-2")).toBeDefined();
    expect(
      (within(screen.getByTestId("db-row-row-1")).getByTestId("db-cell-row-1-title") as HTMLInputElement)
        .value,
    ).toBe("First");
  });

  test("shows an empty-state row when there are no records", () => {
    render(
      <TableView
        database={database}
        rows={[]}
        editable
        onSetValue={noop}
        onCreateRow={noop}
        onDeleteRow={noop}
      />,
    );

    expect(screen.getByText("No rows yet")).toBeDefined();
  });

  test("adds and deletes rows through the controls", () => {
    const onCreateRow = vi.fn();
    const onDeleteRow = vi.fn();
    render(
      <TableView
        database={database}
        rows={rows}
        editable
        onSetValue={noop}
        onCreateRow={onCreateRow}
        onDeleteRow={onDeleteRow}
      />,
    );

    screen.getByTestId("db-table-add").click();
    expect(onCreateRow).toHaveBeenCalledOnce();

    screen.getByTestId("db-row-delete-row-2").click();
    expect(onDeleteRow).toHaveBeenCalledWith("row-2");
  });

  test("hides the add and delete controls when not editable", () => {
    render(
      <TableView
        database={database}
        rows={rows}
        editable={false}
        onSetValue={noop}
        onCreateRow={noop}
        onDeleteRow={noop}
      />,
    );

    expect(screen.queryByTestId("db-table-add")).toBeNull();
    expect(screen.queryByTestId("db-row-delete-row-1")).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });
});
