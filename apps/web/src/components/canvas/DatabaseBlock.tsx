import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { LayoutGrid, Table2, CalendarDays, X } from "lucide-react";
import type {
  CanvasDatabase,
  CanvasDatabaseRow,
  ChannelId,
  DbView,
  DbViewType,
} from "@openslaq/shared";
import {
  fetchDatabase,
  createDatabaseRowOp,
  updateDatabaseRowOp,
  deleteDatabaseRowOp,
} from "@openslaq/client-core";
import { useOperationDeps } from "../../hooks/chat/useOperationDeps";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useCanvasContext } from "./canvas-context";
import { BoardView } from "./BoardView";
import { TableView } from "./TableView";
import { CalendarView } from "./CalendarView";
import { findProperty, findOption, optionClasses, titleProperty } from "./db-helpers";
import { LoadingState } from "../ui";

const VIEW_ICONS: Record<DbViewType, React.ReactNode> = {
  board: <LayoutGrid className="w-3.5 h-3.5" />,
  table: <Table2 className="w-3.5 h-3.5" />,
  calendar: <CalendarDays className="w-3.5 h-3.5" />,
};

type CellValue = string | number | boolean | null;

interface RowDetailProps {
  database: CanvasDatabase;
  row: CanvasDatabaseRow;
  editable: boolean;
  onClose: () => void;
  onSetValue: (rowId: string, propertyId: string, value: CellValue) => void;
  onDelete: (rowId: string) => void;
}

/** Inline editor for every property of a single row. */
function RowDetail({ database, row, editable, onClose, onSetValue, onDelete }: RowDetailProps) {
  return (
    <div
      className="mt-2 rounded-lg border border-border-default bg-surface-secondary p-3"
      data-testid="db-row-detail"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-muted">Row</span>
        <div className="flex items-center gap-2">
          {editable && (
            <button
              type="button"
              data-testid="db-row-detail-delete"
              onClick={() => onDelete(row.id)}
              className="text-[12px] text-danger-text hover:underline border-none bg-transparent cursor-pointer"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            aria-label="Close row"
            data-testid="db-row-detail-close"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary border-none bg-transparent cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {database.properties.map((property) => {
          const value = row.values[property.id];
          const inputId = `row-${row.id}-${property.id}`;
          return (
            <div key={property.id} className="flex items-center gap-2">
              <label htmlFor={inputId} className="w-24 shrink-0 text-[12px] text-muted truncate">
                {property.name}
              </label>

              {property.type === "select" ? (
                <select
                  id={inputId}
                  disabled={!editable}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onSetValue(row.id, property.id, e.target.value || null)}
                  className={clsx(
                    "text-[12px] rounded px-1.5 py-1 border-none outline-none cursor-pointer",
                    findOption(property, value)
                      ? optionClasses(findOption(property, value)?.color)
                      : "bg-surface text-secondary",
                  )}
                >
                  <option value="">—</option>
                  {(property.options ?? []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              ) : property.type === "checkbox" ? (
                <input
                  id={inputId}
                  type="checkbox"
                  disabled={!editable}
                  checked={value === true}
                  onChange={(e) => onSetValue(row.id, property.id, e.target.checked)}
                  className="w-[15px] h-[15px] accent-slaq-blue cursor-pointer"
                />
              ) : property.type === "date" ? (
                <input
                  id={inputId}
                  type="date"
                  disabled={!editable}
                  value={typeof value === "string" ? value.slice(0, 10) : ""}
                  onChange={(e) => onSetValue(row.id, property.id, e.target.value || null)}
                  className="flex-1 bg-surface rounded px-2 py-1 text-[13px] text-primary border border-border-default outline-none"
                />
              ) : property.type === "number" ? (
                <input
                  id={inputId}
                  type="number"
                  disabled={!editable}
                  defaultValue={typeof value === "number" ? value : ""}
                  onBlur={(e) =>
                    onSetValue(row.id, property.id, e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="flex-1 bg-surface rounded px-2 py-1 text-[13px] text-primary border border-border-default outline-none"
                />
              ) : (
                <input
                  id={inputId}
                  type="text"
                  disabled={!editable}
                  defaultValue={typeof value === "string" ? value : ""}
                  onBlur={(e) => onSetValue(row.id, property.id, e.target.value || null)}
                  className="flex-1 bg-surface rounded px-2 py-1 text-[13px] text-primary border border-border-default outline-none"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DatabaseBlockProps {
  databaseId: string;
}

export function DatabaseBlock({ databaseId }: DatabaseBlockProps) {
  const deps = useOperationDeps();
  const { workspaceSlug, channelId, editable } = useCanvasContext();

  const [database, setDatabase] = useState<CanvasDatabase | null>(null);
  const [rows, setRows] = useState<CanvasDatabaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDatabase(deps, { workspaceSlug, channelId, databaseId })
      .then((data) => {
        if (cancelled) return;
        setDatabase(data.database);
        setRows(data.rows);
        setActiveViewId((current) => current ?? data.database.views[0]?.id ?? null);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this database.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deps, workspaceSlug, channelId, databaseId]);

  // Live updates from other people editing the same database.
  const onRowUpserted = useCallback(
    (payload: { databaseId: string; row: CanvasDatabaseRow }) => {
      if (payload.databaseId !== databaseId) return;
      setRows((prev) => {
        const index = prev.findIndex((r) => r.id === payload.row.id);
        if (index === -1) return [...prev, payload.row];
        const next = [...prev];
        next[index] = payload.row;
        return next;
      });
    },
    [databaseId],
  );

  const onRowRemoved = useCallback(
    (payload: { databaseId: string; rowId: string }) => {
      if (payload.databaseId !== databaseId) return;
      setRows((prev) => prev.filter((r) => r.id !== payload.rowId));
    },
    [databaseId],
  );

  const onDatabaseUpdated = useCallback(
    (payload: { channelId: ChannelId; database: CanvasDatabase }) => {
      if (payload.database.id !== databaseId) return;
      setDatabase(payload.database);
    },
    [databaseId],
  );

  useSocketEvent("database:rowUpserted", onRowUpserted);
  useSocketEvent("database:rowRemoved", onRowRemoved);
  useSocketEvent("database:updated", onDatabaseUpdated);

  const activeView: DbView | null = useMemo(() => {
    if (!database) return null;
    return database.views.find((v) => v.id === activeViewId) ?? database.views[0] ?? null;
  }, [database, activeViewId]);

  const setValue = useCallback(
    (rowId: string, propertyId: string, value: CellValue) => {
      const current = rows.find((r) => r.id === rowId);
      if (!current) return;
      const nextValues = { ...current.values, [propertyId]: value };

      // Optimistic — the socket echo confirms.
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, values: nextValues } : r)));

      void updateDatabaseRowOp(deps, {
        workspaceSlug,
        channelId,
        databaseId,
        rowId,
        patch: { values: nextValues },
      }).catch(() => {
        setRows((prev) => prev.map((r) => (r.id === rowId ? current : r)));
      });
    },
    [rows, deps, workspaceSlug, channelId, databaseId],
  );

  const createRow = useCallback(
    (seed: Record<string, CellValue>) => {
      void createDatabaseRowOp(deps, { workspaceSlug, channelId, databaseId, values: seed })
        .then((row) => setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row])))
        .catch(() => setError("Couldn't add that row."));
    },
    [deps, workspaceSlug, channelId, databaseId],
  );

  const deleteRow = useCallback(
    (rowId: string) => {
      const previous = rows;
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setOpenRowId((id) => (id === rowId ? null : id));
      void deleteDatabaseRowOp(deps, { workspaceSlug, channelId, databaseId, rowId }).catch(() => {
        setRows(previous);
      });
    },
    [rows, deps, workspaceSlug, channelId, databaseId],
  );

  if (loading) return <LoadingState label="Loading database..." size="sm" />;
  if (error && !database) {
    return <div className="p-3 text-[13px] text-danger-text">{error}</div>;
  }
  if (!database || !activeView) return null;

  // Standalone calendars have no board view to borrow grouping from, so fall
  // back to the first select property to keep entries colour-coded.
  const groupPropertyId =
    activeView.groupByPropertyId ??
    database.views.find((v) => v.type === "board")?.groupByPropertyId ??
    database.properties.find((p) => p.type === "select")?.id ??
    null;
  const openRow = rows.find((r) => r.id === openRowId) ?? null;
  const title = titleProperty(database.properties);

  const seedFor = (extra: Record<string, CellValue>): Record<string, CellValue> => ({
    ...(title ? { [title.id]: "Untitled" } : {}),
    ...extra,
  });

  return (
    <div
      className="my-3 rounded-lg border border-border-default bg-surface p-3"
      data-testid={`db-block-${databaseId}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-primary truncate">{database.name}</span>
        {/* One view means this block was inserted as a standalone calendar,
            board or table — no point offering a switcher. */}
        <div className={clsx("items-center gap-0.5", database.views.length > 1 ? "flex" : "hidden")}>
          {database.views.map((view) => (
            <button
              key={view.id}
              type="button"
              data-testid={`db-view-${view.type}`}
              onClick={() => setActiveViewId(view.id)}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded text-[12px] border-none cursor-pointer transition-colors",
                view.id === activeView.id
                  ? "bg-surface-selected text-primary font-medium"
                  : "bg-transparent text-muted hover:text-primary hover:bg-surface-hover",
              )}
            >
              {VIEW_ICONS[view.type]}
              {view.name}
            </button>
          ))}
        </div>
      </div>

      {activeView.type === "board" && (
        <BoardView
          database={database}
          rows={rows}
          groupPropertyId={groupPropertyId}
          editable={editable}
          onMoveRow={(rowId, optionId) => {
            const prop = findProperty(database.properties, groupPropertyId);
            if (prop) setValue(rowId, prop.id, optionId);
          }}
          onCreateRow={(optionId) => {
            const prop = findProperty(database.properties, groupPropertyId);
            createRow(seedFor(prop && optionId ? { [prop.id]: optionId } : {}));
          }}
          onOpenRow={(row) => setOpenRowId(row.id)}
        />
      )}

      {activeView.type === "table" && (
        <TableView
          database={database}
          rows={rows}
          editable={editable}
          onSetValue={setValue}
          onCreateRow={() => createRow(seedFor({}))}
          onDeleteRow={deleteRow}
        />
      )}

      {activeView.type === "calendar" && (
        <CalendarView
          database={database}
          rows={rows}
          datePropertyId={activeView.datePropertyId}
          groupPropertyId={groupPropertyId}
          editable={editable}
          onSetValue={setValue}
          onCreateRowOnDate={(dateKey) => {
            const dateProp = findProperty(database.properties, activeView.datePropertyId);
            createRow(seedFor(dateProp ? { [dateProp.id]: dateKey } : {}));
          }}
          onOpenRow={(row) => setOpenRowId(row.id)}
        />
      )}

      {openRow && (
        <RowDetail
          database={database}
          row={openRow}
          editable={editable}
          onClose={() => setOpenRowId(null)}
          onSetValue={setValue}
          onDelete={deleteRow}
        />
      )}
    </div>
  );
}
