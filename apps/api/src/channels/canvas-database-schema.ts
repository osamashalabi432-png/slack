import { pgTable, text, timestamp, uuid, integer, jsonb, index } from "drizzle-orm/pg-core";
import { channels } from "./schema";
import { channelTabs } from "./tab-schema";
import { users } from "../users/schema";
import type { DbProperty, DbRowValues, DbView } from "@openslaq/shared";

/**
 * A structured dataset embedded in a canvas. The canvas document stores only
 * the id, so row edits never race with the document's own autosave.
 */
export const canvasDatabases = pgTable(
  "canvas_databases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    tabId: uuid("tab_id").references(() => channelTabs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    properties: jsonb("properties").$type<DbProperty[]>().notNull(),
    views: jsonb("views").$type<DbView[]>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_canvas_databases_channel").on(t.channelId)],
);

export const canvasDatabaseRows = pgTable(
  "canvas_database_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => canvasDatabases.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    values: jsonb("values").$type<DbRowValues>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_canvas_database_rows_database").on(t.databaseId)],
);
