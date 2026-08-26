import type { CanvasDatabaseRow, DbOptionColor, DbProperty, DbSelectOption } from "@openslaq/shared";

/** Tailwind classes for select-option chips, one per palette color. */
export const OPTION_COLOR_CLASSES: Record<DbOptionColor, string> = {
  gray: "bg-gray-500/20 text-gray-300 dark:text-gray-300",
  red: "bg-red-500/20 text-red-300",
  orange: "bg-orange-500/20 text-orange-300",
  yellow: "bg-yellow-500/20 text-yellow-300",
  green: "bg-green-500/20 text-green-300",
  blue: "bg-blue-500/20 text-blue-300",
  purple: "bg-purple-500/20 text-purple-300",
  pink: "bg-pink-500/20 text-pink-300",
};

export function optionClasses(color: DbOptionColor | undefined): string {
  return OPTION_COLOR_CLASSES[color ?? "gray"];
}

export function findProperty(properties: DbProperty[], id: string | null | undefined): DbProperty | null {
  if (!id) return null;
  return properties.find((p) => p.id === id) ?? null;
}

export function findOption(property: DbProperty | null, value: unknown): DbSelectOption | null {
  if (!property?.options || typeof value !== "string") return null;
  return property.options.find((o) => o.id === value) ?? null;
}

/** The property that acts as a row's headline. */
export function titleProperty(properties: DbProperty[]): DbProperty | null {
  return properties.find((p) => p.type === "title") ?? properties[0] ?? null;
}

export function rowTitle(row: CanvasDatabaseRow, properties: DbProperty[]): string {
  const prop = titleProperty(properties);
  const value = prop ? row.values[prop.id] : null;
  return typeof value === "string" && value.trim() ? value : "Untitled";
}

/** Renders a stored cell value as display text. */
export function formatValue(property: DbProperty, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  switch (property.type) {
    case "checkbox":
      return value ? "Yes" : "No";
    case "date":
      return typeof value === "string" ? formatDate(value) : "";
    case "select":
      return findOption(property, value)?.name ?? "";
    default:
      return String(value);
  }
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** `YYYY-MM-DD` in local time — the storage format for date cells. */
export function toDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateKeyOf(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  // Stored values are already date keys, but tolerate full ISO strings.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return value.length === 10 ? value : toDateKey(parsed);
}

/** Days to render for a month grid, padded to whole weeks starting Sunday. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  // Trim a trailing all-next-month week when the month fits in five.
  const lastVisible = days[34];
  if (lastVisible && lastVisible.getMonth() !== month) return days.slice(0, 35);
  return days;
}

export interface RowGroup {
  option: DbSelectOption | null;
  rows: CanvasDatabaseRow[];
}

/** Groups rows by the value of a select property, preserving option order. */
export function groupRows(
  rows: CanvasDatabaseRow[],
  property: DbProperty | null,
): RowGroup[] {
  if (!property?.options) return [{ option: null, rows }];

  const groups: RowGroup[] = property.options.map((option) => ({
    option,
    rows: rows.filter((r) => r.values[property.id] === option.id),
  }));

  const ungrouped = rows.filter(
    (r) => !property.options!.some((o) => o.id === r.values[property.id]),
  );
  if (ungrouped.length > 0) groups.push({ option: null, rows: ungrouped });

  return groups;
}
