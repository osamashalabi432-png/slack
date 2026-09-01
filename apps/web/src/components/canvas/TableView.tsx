import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import type { CanvasDatabase, CanvasDatabaseRow, DbProperty } from "@openslaq/shared";
import { optionClasses, findOption } from "./db-helpers";

interface TableViewProps {
  database: CanvasDatabase;
  rows: CanvasDatabaseRow[];
  editable: boolean;
  onSetValue: (rowId: string, propertyId: string, value: string | number | boolean | null) => void;
  onCreateRow: (optionId: string | null) => void;
  onDeleteRow: (rowId: string) => void;
}

const cellInput =
  "w-full bg-transparent border-none outline-none text-[13px] text-primary placeholder:text-faint";

function Cell({
  property,
  row,
  editable,
  onSetValue,
}: {
  property: DbProperty;
  row: CanvasDatabaseRow;
  editable: boolean;
  onSetValue: TableViewProps["onSetValue"];
}) {
  const value = row.values[property.id];
  const testId = `db-cell-${row.id}-${property.id}`;

  if (property.type === "checkbox") {
    return (
      <input
        type="checkbox"
        data-testid={testId}
        disabled={!editable}
        checked={value === true}
        onChange={(e) => onSetValue(row.id, property.id, e.target.checked)}
        className="w-[15px] h-[15px] cursor-pointer accent-slaq-blue"
      />
    );
  }

  if (property.type === "select") {
    const option = findOption(property, value);
    return (
      <select
        data-testid={testId}
        disabled={!editable}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSetValue(row.id, property.id, e.target.value || null)}
        className={clsx(
          "text-[12px] rounded px-1.5 py-0.5 border-none outline-none cursor-pointer max-w-full",
          option ? optionClasses(option.color) : "bg-transparent text-faint",
        )}
      >
        <option value="">—</option>
        {(property.options ?? []).map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
    );
  }

  if (property.type === "date") {
    return (
      <input
        type="date"
        data-testid={testId}
        disabled={!editable}
        value={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(e) => onSetValue(row.id, property.id, e.target.value || null)}
        className={clsx(cellInput, "cursor-pointer")}
      />
    );
  }

  if (property.type === "number") {
    return (
      <input
        type="number"
        data-testid={testId}
        disabled={!editable}
        defaultValue={typeof value === "number" ? value : ""}
        onBlur={(e) =>
          onSetValue(row.id, property.id, e.target.value === "" ? null : Number(e.target.value))
        }
        className={cellInput}
      />
    );
  }

  return (
    <input
      type="text"
      data-testid={testId}
      disabled={!editable}
      defaultValue={typeof value === "string" ? value : ""}
      placeholder={property.type === "title" ? "Untitled" : ""}
      onBlur={(e) => onSetValue(row.id, property.id, e.target.value || null)}
      className={clsx(cellInput, property.type === "title" && "font-semibold")}
    />
  );
}

// Shared grid lines: a right border on every cell and a bottom border on every
// row give the view real columns and rows. The wrapper draws the outer frame,
// and `last:border-r-0` / the last-row rule stop the doubled edge against it.
const headCell =
  "border-b border-r border-border-default last:border-r-0 bg-surface-secondary px-2.5 py-2 text-[12px] font-semibold text-secondary whitespace-nowrap";
const bodyCell =
  "border-b border-r border-border-default last:border-r-0 px-2.5 py-1.5 align-middle min-w-[140px]";

export function TableView({
  database,
  rows,
  editable,
  onSetValue,
  onCreateRow,
  onDeleteRow,
}: TableViewProps) {
  const columnCount = database.properties.length + (editable ? 1 : 0);

  return (
    <div className="overflow-x-auto" data-testid="db-table">
      <div className="min-w-full overflow-hidden rounded-lg border border-border-default">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr>
              {database.properties.map((property) => (
                <th key={property.id} className={headCell}>
                  {property.name}
                </th>
              ))}
              {editable && <th aria-hidden className={clsx(headCell, "w-8 min-w-0")} />}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="border-b border-border-default px-2.5 py-3 text-[13px] text-faint"
                >
                  No rows yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`db-row-${row.id}`}
                  className="group hover:bg-surface-hover"
                >
                  {database.properties.map((property) => (
                    <td key={property.id} className={bodyCell}>
                      <Cell
                        property={property}
                        row={row}
                        editable={editable}
                        onSetValue={onSetValue}
                      />
                    </td>
                  ))}
                  {editable && (
                    <td className="border-b border-border-default px-1 w-8 align-middle">
                      <button
                        type="button"
                        aria-label="Delete row"
                        data-testid={`db-row-delete-${row.id}`}
                        onClick={() => onDeleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger-text border-none bg-transparent cursor-pointer transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {editable && (
          <button
            type="button"
            data-testid="db-table-add"
            onClick={() => onCreateRow(null)}
            className="flex w-full items-center gap-1.5 border-t border-border-default px-2.5 py-2 text-[13px] text-muted hover:bg-surface-hover hover:text-primary border-x-0 border-b-0 bg-transparent cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New row
          </button>
        )}
      </div>
    </div>
  );
}
