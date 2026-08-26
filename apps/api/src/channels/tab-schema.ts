import { pgTable, text, timestamp, uuid, integer, jsonb, index } from "drizzle-orm/pg-core";
import { channels } from "./schema";
import { users } from "../users/schema";
import type { CanvasContent } from "@openslaq/shared";

/**
 * Tabs pinned to the top of a channel, alongside the implicit Messages tab.
 * Canvas documents keep their ProseMirror JSON body in `content`.
 */
export const channelTabs = pgTable(
  "channel_tabs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    content: jsonb("content").$type<CanvasContent>(),
    /** Canvas tabs are pages now; this points at the page holding the body. */
    pageId: uuid("page_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("idx_channel_tabs_channel").on(t.channelId)],
);
