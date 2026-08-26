import type { ChannelId, ChannelTabId, UserId } from "./ids";

/** Column kinds a canvas database can hold. */
export const DB_PROPERTY_TYPES = ["title", "text", "select", "date", "checkbox", "number"] as const;
export type DbPropertyType = (typeof DB_PROPERTY_TYPES)[number];

/** Palette used for select-option chips; the client maps these to theme colors. */
export const DB_OPTION_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;
export type DbOptionColor = (typeof DB_OPTION_COLORS)[number];

export interface DbSelectOption {
  id: string;
  name: string;
  color: DbOptionColor;
}

export interface DbProperty {
  id: string;
  name: string;
  type: DbPropertyType;
  /** Only present for `select` properties. */
  options?: DbSelectOption[];
}

export const DB_VIEW_TYPES = ["board", "table", "calendar"] as const;
export type DbViewType = (typeof DB_VIEW_TYPES)[number];

export interface DbView {
  id: string;
  name: string;
  type: DbViewType;
  /** Select property whose options become board columns. */
  groupByPropertyId?: string | null;
  /** Date property that places rows on the calendar. */
  datePropertyId?: string | null;
}

/** Cell values keyed by property id. Shape depends on the property type. */
export type DbRowValues = Record<string, string | number | boolean | null>;

export interface CanvasDatabase {
  id: string;
  channelId: ChannelId;
  tabId: ChannelTabId | null;
  name: string;
  properties: DbProperty[];
  views: DbView[];
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDatabaseRow {
  id: string;
  databaseId: string;
  position: number;
  values: DbRowValues;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDatabaseWithRows {
  database: CanvasDatabase;
  rows: CanvasDatabaseRow[];
}

/**
 * Which flavour of block to create. `full` carries all three views; the
 * others are single-view blocks that can be dropped in on their own.
 */
export const DATABASE_PRESETS = ["full", "calendar", "board", "table"] as const;
export type DatabasePreset = (typeof DATABASE_PRESETS)[number];

const statusProperty: DbProperty = {
  id: "status",
  name: "Status",
  type: "select",
  options: [
    { id: "not-started", name: "Not started", color: "gray" },
    { id: "in-progress", name: "In progress", color: "blue" },
    { id: "done", name: "Done", color: "green" },
  ],
};

const priorityProperty: DbProperty = {
  id: "priority",
  name: "Priority",
  type: "select",
  options: [
    { id: "low", name: "Low", color: "gray" },
    { id: "medium", name: "Medium", color: "yellow" },
    { id: "high", name: "High", color: "red" },
  ],
};

const titlePropertyDef: DbProperty = { id: "title", name: "Name", type: "title" };
const datePropertyDef: DbProperty = { id: "date", name: "Date", type: "date" };
const notesPropertyDef: DbProperty = { id: "notes", name: "Notes", type: "text" };

/** Default block name shown when a preset is inserted. */
export const PRESET_NAMES: Record<DatabasePreset, string> = {
  full: "Untitled database",
  calendar: "Calendar",
  board: "Board",
  table: "Table",
};

/**
 * Schema for a given preset. Single-view presets still store their rows the
 * same way, so a block can gain the other views later without migrating data.
 */
export function databaseSchemaForPreset(
  preset: DatabasePreset,
): { properties: DbProperty[]; views: DbView[] } {
  switch (preset) {
    case "calendar":
      return {
        properties: [titlePropertyDef, datePropertyDef, statusProperty, notesPropertyDef],
        views: [{ id: "calendar", name: "Calendar", type: "calendar", datePropertyId: "date" }],
      };
    case "board":
      return {
        properties: [titlePropertyDef, statusProperty, priorityProperty, notesPropertyDef],
        views: [{ id: "board", name: "Board", type: "board", groupByPropertyId: "status" }],
      };
    case "table":
      return {
        properties: [titlePropertyDef, statusProperty, datePropertyDef, notesPropertyDef],
        views: [{ id: "table", name: "Table", type: "table" }],
      };
    case "full":
    default:
      return defaultDatabaseSchema();
  }
}

/** The starter schema a full database block gets: all three views. */
export function defaultDatabaseSchema(): { properties: DbProperty[]; views: DbView[] } {
  const properties: DbProperty[] = [
    { id: "title", name: "Name", type: "title" },
    {
      id: "status",
      name: "Status",
      type: "select",
      options: [
        { id: "not-started", name: "Not started", color: "gray" },
        { id: "in-progress", name: "In progress", color: "blue" },
        { id: "done", name: "Done", color: "green" },
      ],
    },
    {
      id: "priority",
      name: "Priority",
      type: "select",
      options: [
        { id: "low", name: "Low", color: "gray" },
        { id: "medium", name: "Medium", color: "yellow" },
        { id: "high", name: "High", color: "red" },
      ],
    },
    { id: "date", name: "Date", type: "date" },
    { id: "notes", name: "Notes", type: "text" },
  ];

  const views: DbView[] = [
    { id: "board", name: "Board", type: "board", groupByPropertyId: "status" },
    { id: "table", name: "Table", type: "table" },
  ];

  return { properties, views };
}
