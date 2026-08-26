import { describe, test, expect } from "vitest";
import type { CanvasDatabaseRow, DatabasePreset, DbProperty, UserId } from "@openslaq/shared";
import { DATABASE_PRESETS, PRESET_NAMES, databaseSchemaForPreset } from "@openslaq/shared";
import {
  findProperty,
  findOption,
  titleProperty,
  rowTitle,
  formatValue,
  toDateKey,
  dateKeyOf,
  monthGrid,
  groupRows,
} from "./db-helpers";

const statusProperty: DbProperty = {
  id: "status",
  name: "Status",
  type: "select",
  options: [
    { id: "todo", name: "To do", color: "gray" },
    { id: "doing", name: "Doing", color: "blue" },
  ],
};

const properties: DbProperty[] = [
  { id: "title", name: "Name", type: "title" },
  statusProperty,
  { id: "due", name: "Due", type: "date" },
  { id: "done", name: "Done", type: "checkbox" },
  { id: "count", name: "Count", type: "number" },
];

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

describe("property lookup", () => {
  test("finds a property by id and tolerates missing ids", () => {
    expect(findProperty(properties, "status")?.name).toBe("Status");
    expect(findProperty(properties, "nope")).toBeNull();
    expect(findProperty(properties, null)).toBeNull();
  });

  test("resolves select options, ignoring non-select properties", () => {
    expect(findOption(statusProperty, "doing")?.name).toBe("Doing");
    expect(findOption(statusProperty, "missing")).toBeNull();
    expect(findOption(properties[0]!, "todo")).toBeNull();
  });

  test("uses the title property, falling back to the first column", () => {
    expect(titleProperty(properties)?.id).toBe("title");
    expect(titleProperty([statusProperty])?.id).toBe("status");
    expect(titleProperty([])).toBeNull();
  });
});

describe("rowTitle", () => {
  test("returns the stored title", () => {
    expect(rowTitle(makeRow("r1", { title: "Ship it" }), properties)).toBe("Ship it");
  });

  test("falls back to Untitled for blank or missing titles", () => {
    expect(rowTitle(makeRow("r1", { title: "   " }), properties)).toBe("Untitled");
    expect(rowTitle(makeRow("r2", {}), properties)).toBe("Untitled");
  });
});

describe("formatValue", () => {
  test("renders each property type", () => {
    expect(formatValue(statusProperty, "doing")).toBe("Doing");
    expect(formatValue(properties[3]!, true)).toBe("Yes");
    expect(formatValue(properties[3]!, false)).toBe("No");
    expect(formatValue(properties[4]!, 7)).toBe("7");
    expect(formatValue(properties[2]!, "2026-08-21")).toContain("2026");
  });

  test("renders empty values as an empty string", () => {
    expect(formatValue(statusProperty, null)).toBe("");
    expect(formatValue(properties[0]!, "")).toBe("");
  });
});

describe("date keys", () => {
  test("formats a local date as YYYY-MM-DD with padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  test("passes through stored keys and normalizes full timestamps", () => {
    expect(dateKeyOf("2026-08-21")).toBe("2026-08-21");
    expect(dateKeyOf("")).toBeNull();
    expect(dateKeyOf(null)).toBeNull();
    expect(dateKeyOf("not a date")).toBeNull();
    expect(dateKeyOf(12345)).toBeNull();
  });
});

describe("monthGrid", () => {
  test("starts on a Sunday and covers whole weeks", () => {
    const days = monthGrid(2026, 7); // August 2026
    expect(days[0]!.getDay()).toBe(0);
    expect(days.length % 7).toBe(0);
    expect([35, 42]).toContain(days.length);
  });

  test("includes every day of the target month", () => {
    const days = monthGrid(2026, 7);
    const inMonth = days.filter((d) => d.getMonth() === 7);
    expect(inMonth).toHaveLength(31);
  });

  test("handles a February that starts on a Sunday", () => {
    const days = monthGrid(2026, 1);
    expect(days[0]!.getDay()).toBe(0);
    expect(days.filter((d) => d.getMonth() === 1)).toHaveLength(28);
  });
});

describe("groupRows", () => {
  test("groups rows into option order", () => {
    const rows = [
      makeRow("a", { status: "doing" }),
      makeRow("b", { status: "todo" }),
      makeRow("c", { status: "doing" }),
    ];
    const groups = groupRows(rows, statusProperty);

    expect(groups.map((g) => g.option?.id)).toEqual(["todo", "doing"]);
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(["b"]);
    expect(groups[1]!.rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  test("collects unmatched rows into a trailing ungrouped column", () => {
    const rows = [makeRow("a", { status: "todo" }), makeRow("b", {}), makeRow("c", { status: "gone" })];
    const groups = groupRows(rows, statusProperty);

    const last = groups.at(-1)!;
    expect(last.option).toBeNull();
    expect(last.rows.map((r) => r.id)).toEqual(["b", "c"]);
  });

  test("omits the ungrouped column when everything matches", () => {
    const groups = groupRows([makeRow("a", { status: "todo" })], statusProperty);
    expect(groups.every((g) => g.option !== null)).toBe(true);
  });

  test("returns a single group when there is no grouping property", () => {
    const rows = [makeRow("a", {}), makeRow("b", {})];
    const groups = groupRows(rows, null);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows).toHaveLength(2);
  });
});

describe("databaseSchemaForPreset", () => {
  test("single-view presets carry exactly one view of their own type", () => {
    for (const preset of ["calendar", "board", "table"] as const) {
      const { views } = databaseSchemaForPreset(preset);
      expect(views).toHaveLength(1);
      expect(views[0]!.type).toBe(preset);
    }
  });

  test("the full preset is board and table — the calendar is its own block", () => {
    const { views } = databaseSchemaForPreset("full");
    expect(views.map((v) => v.type).sort()).toEqual(["board", "table"]);
  });

  test("a calendar preset can actually place rows", () => {
    const { properties, views } = databaseSchemaForPreset("calendar");
    const dateId = views[0]!.datePropertyId;
    expect(dateId).toBeTruthy();
    expect(properties.some((p) => p.id === dateId && p.type === "date")).toBe(true);
  });

  test("a board preset can actually group rows", () => {
    const { properties, views } = databaseSchemaForPreset("board");
    const groupId = views[0]!.groupByPropertyId;
    expect(groupId).toBeTruthy();
    const grouped = properties.find((p) => p.id === groupId);
    expect(grouped?.type).toBe("select");
    expect(grouped?.options?.length).toBeGreaterThan(0);
  });

  test("every preset has a title property so rows can be named", () => {
    for (const preset of DATABASE_PRESETS) {
      const { properties } = databaseSchemaForPreset(preset);
      expect(properties.some((p) => p.type === "title")).toBe(true);
    }
  });

  test("every view references properties that exist in the same schema", () => {
    for (const preset of DATABASE_PRESETS) {
      const { properties, views } = databaseSchemaForPreset(preset);
      const ids = new Set(properties.map((p) => p.id));
      for (const view of views) {
        if (view.groupByPropertyId) expect(ids.has(view.groupByPropertyId)).toBe(true);
        if (view.datePropertyId) expect(ids.has(view.datePropertyId)).toBe(true);
      }
    }
  });

  test("every preset has a display name", () => {
    for (const preset of DATABASE_PRESETS) {
      expect(PRESET_NAMES[preset as DatabasePreset]).toBeTruthy();
    }
  });
});
