import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { CanvasDatabase, CanvasDatabaseRow } from "@openslaq/shared";
import { findProperty, findOption, optionClasses, rowTitle, dateKeyOf, toDateKey, monthGrid } from "./db-helpers";

interface CalendarViewProps {
  database: CanvasDatabase;
  rows: CanvasDatabaseRow[];
  datePropertyId: string | null | undefined;
  groupPropertyId: string | null | undefined;
  editable: boolean;
  onSetValue: (rowId: string, propertyId: string, value: string | number | boolean | null) => void;
  onCreateRowOnDate: (dateKey: string) => void;
  onOpenRow: (row: CanvasDatabaseRow) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  database,
  rows,
  datePropertyId,
  groupPropertyId,
  editable,
  onSetValue,
  onCreateRowOnDate,
  onOpenRow,
}: CalendarViewProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const dateProperty = findProperty(database.properties, datePropertyId);
  const groupProperty = findProperty(database.properties, groupPropertyId);

  const days = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CanvasDatabaseRow[]>();
    if (!dateProperty) return map;
    for (const row of rows) {
      const key = dateKeyOf(row.values[dateProperty.id]);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [rows, dateProperty]);

  const undated = dateProperty
    ? rows.filter((r) => !dateKeyOf(r.values[dateProperty.id]))
    : rows;

  if (!dateProperty) {
    return (
      <div className="p-4 text-[13px] text-muted" data-testid="db-calendar">
        This view needs a date property. Add one to place rows on the calendar.
      </div>
    );
  }

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = toDateKey(today);

  return (
    <div data-testid="db-calendar">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-primary">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            data-testid="db-calendar-prev"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="db-calendar-today"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-2 h-6 rounded text-[12px] text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            data-testid="db-calendar-next"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-border-default rounded-md overflow-hidden">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-1 text-[11px] text-muted border-r border-b border-border-default bg-surface-secondary"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const dayRows = byDay.get(key) ?? [];

          return (
            <div
              key={key}
              data-testid={`db-calendar-day-${key}`}
              onDragOver={(e) => {
                if (!dragRowId) return;
                e.preventDefault();
                setOverDay(key);
              }}
              onDragLeave={() => setOverDay((d) => (d === key ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragRowId) onSetValue(dragRowId, dateProperty.id, key);
                setDragRowId(null);
                setOverDay(null);
              }}
              className={clsx(
                "min-h-[92px] p-1 border-r border-b border-border-default align-top transition-colors group",
                !inMonth && "bg-surface-secondary/40",
                overDay === key && "bg-surface-selected",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={clsx(
                    "text-[11px] px-1 rounded",
                    key === todayKey
                      ? "bg-slaq-blue text-white font-semibold"
                      : inMonth
                        ? "text-secondary"
                        : "text-faint",
                  )}
                >
                  {day.getDate()}
                </span>
                {editable && (
                  <button
                    type="button"
                    aria-label={`Add on ${key}`}
                    data-testid={`db-calendar-add-${key}`}
                    onClick={() => onCreateRowOnDate(key)}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-muted hover:text-primary border-none bg-transparent cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {dayRows.map((row) => {
                  const option = groupProperty ? findOption(groupProperty, row.values[groupProperty.id]) : null;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      data-testid={`db-calendar-row-${row.id}`}
                      draggable={editable}
                      onDragStart={() => setDragRowId(row.id)}
                      onDragEnd={() => {
                        setDragRowId(null);
                        setOverDay(null);
                      }}
                      onClick={() => onOpenRow(row)}
                      className={clsx(
                        "w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight border-none cursor-pointer truncate",
                        option ? optionClasses(option.color) : "bg-surface-tertiary text-secondary",
                        dragRowId === row.id && "opacity-50",
                      )}
                    >
                      {rowTitle(row, database.properties)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="mt-3">
          <span className="text-[12px] text-muted">Not scheduled</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {undated.map((row) => (
              <button
                key={row.id}
                type="button"
                data-testid={`db-calendar-undated-${row.id}`}
                draggable={editable}
                onDragStart={() => setDragRowId(row.id)}
                onDragEnd={() => setDragRowId(null)}
                onClick={() => onOpenRow(row)}
                className="rounded border border-border-default bg-surface px-2 py-1 text-[12px] text-secondary cursor-pointer hover:border-border-strong"
              >
                {rowTitle(row, database.properties)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
