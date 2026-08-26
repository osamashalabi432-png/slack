import { useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import type { CanvasDatabase, CanvasDatabaseRow, DbProperty } from "@openslaq/shared";
import { findProperty, findOption, optionClasses, groupRows, rowTitle, formatDate } from "./db-helpers";

interface BoardViewProps {
  database: CanvasDatabase;
  rows: CanvasDatabaseRow[];
  groupPropertyId: string | null | undefined;
  editable: boolean;
  onMoveRow: (rowId: string, optionId: string | null) => void;
  onCreateRow: (optionId: string | null) => void;
  onOpenRow: (row: CanvasDatabaseRow) => void;
}

/** Secondary properties shown on a card, in order, excluding title/group. */
function cardProperties(database: CanvasDatabase, groupPropertyId: string | null | undefined): DbProperty[] {
  return database.properties.filter(
    (p) => p.type !== "title" && p.id !== groupPropertyId && p.type !== "text",
  );
}

export function BoardView({
  database,
  rows,
  groupPropertyId,
  editable,
  onMoveRow,
  onCreateRow,
  onOpenRow,
}: BoardViewProps) {
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const groupProperty = findProperty(database.properties, groupPropertyId);
  const groups = groupRows(rows, groupProperty);
  const extras = cardProperties(database, groupPropertyId);
  const notesProperty = database.properties.find((p) => p.type === "text");

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" data-testid="db-board">
      {groups.map(({ option, rows: columnRows }) => {
        const columnKey = option?.id ?? "__none__";
        return (
          <div
            key={columnKey}
            data-testid={`db-board-column-${columnKey}`}
            onDragOver={(e) => {
              if (!dragRowId) return;
              e.preventDefault();
              setOverColumn(columnKey);
            }}
            onDragLeave={() => setOverColumn((c) => (c === columnKey ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragRowId) onMoveRow(dragRowId, option?.id ?? null);
              setDragRowId(null);
              setOverColumn(null);
            }}
            className={clsx(
              "w-[260px] shrink-0 rounded-lg p-2 transition-colors",
              overColumn === columnKey ? "bg-surface-selected" : "bg-surface-secondary",
            )}
          >
            <div className="flex items-center gap-2 px-1 pb-2">
              <span
                className={clsx(
                  "text-[12px] font-semibold px-1.5 py-0.5 rounded",
                  optionClasses(option?.color),
                )}
              >
                {option?.name ?? "No status"}
              </span>
              <span className="text-[12px] text-faint">{columnRows.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {columnRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  data-testid={`db-card-${row.id}`}
                  draggable={editable}
                  onDragStart={() => setDragRowId(row.id)}
                  onDragEnd={() => {
                    setDragRowId(null);
                    setOverColumn(null);
                  }}
                  onClick={() => onOpenRow(row)}
                  className={clsx(
                    "w-full text-left rounded-md border border-border-default bg-surface p-2.5 cursor-pointer hover:border-border-strong transition-colors",
                    dragRowId === row.id && "opacity-50",
                  )}
                >
                  <span className="block text-[13px] font-semibold text-primary mb-1 break-words">
                    {rowTitle(row, database.properties)}
                  </span>

                  {notesProperty && typeof row.values[notesProperty.id] === "string" && row.values[notesProperty.id] && (
                    <span className="block text-[12px] text-secondary mb-1.5 line-clamp-3 break-words">
                      {String(row.values[notesProperty.id])}
                    </span>
                  )}

                  <span className="flex flex-wrap items-center gap-1.5">
                    {extras.map((prop) => {
                      const value = row.values[prop.id];
                      if (value === null || value === undefined || value === "") return null;

                      if (prop.type === "select") {
                        const opt = findOption(prop, value);
                        if (!opt) return null;
                        return (
                          <span
                            key={prop.id}
                            className={clsx("text-[11px] px-1.5 py-0.5 rounded", optionClasses(opt.color))}
                          >
                            {opt.name}
                          </span>
                        );
                      }
                      if (prop.type === "date") {
                        return (
                          <span key={prop.id} className="text-[11px] text-muted">
                            {formatDate(String(value))}
                          </span>
                        );
                      }
                      if (prop.type === "checkbox") {
                        return value ? (
                          <span key={prop.id} className="text-[11px] text-muted">
                            {prop.name} ✓
                          </span>
                        ) : null;
                      }
                      return (
                        <span key={prop.id} className="text-[11px] text-muted">
                          {String(value)}
                        </span>
                      );
                    })}
                  </span>
                </button>
              ))}

              {editable && (
                <button
                  type="button"
                  data-testid={`db-board-add-${columnKey}`}
                  onClick={() => onCreateRow(option?.id ?? null)}
                  className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[13px] text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
