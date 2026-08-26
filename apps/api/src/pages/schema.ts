import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "../workspaces/schema";
import { users } from "../users/schema";
import { userGroups } from "../groups/schema";
import { channels } from "../channels/schema";
import type { CanvasContent } from "@openslaq/shared";

/** Postgres `bytea`, for the CRDT state a collaborative editor syncs on. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * A page, the way Notion means it: a document that can contain other pages,
 * without limit. Workspace-wide rather than owned by a channel, so a page can
 * be linked from anywhere.
 *
 * Two copies of the body are kept, deliberately:
 *  - `ydoc` is the source of truth once collaborative editing is on. It is the
 *    merged CRDT state, which is what lets two people type at once.
 *  - `content` is a plain snapshot of the same document, written on save. It
 *    is what search, previews and any non-editor reader use, because none of
 *    them should have to load a CRDT to read a title.
 */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Null for a top-level page; otherwise the page this one sits inside. */
    parentId: uuid("parent_id"),
    /**
     * Set when the page is a channel's tab. Such a page follows the channel
     * for access — a private channel's canvas must not be workspace-readable —
     * and its sub-pages inherit that through the parent walk.
     */
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    /** An emoji, or a URL when someone uploads a custom one. */
    icon: text("icon"),
    coverUrl: text("cover_url"),
    /** Order among siblings. */
    position: integer("position").notNull().default(0),
    content: jsonb("content").$type<CanvasContent>(),
    ydoc: bytea("ydoc"),
    /**
     * Restricts the page to a user group. Null means it follows its parent,
     * and a root page with null is visible to the whole workspace. Reusing
     * groups keeps this from becoming a third, separate permission system.
     */
    restrictedToGroupId: uuid("restricted_to_group_id").references(() => userGroups.id, {
      onDelete: "set null",
    }),
    archived: boolean("archived").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("idx_pages_workspace").on(t.workspaceId),
    index("idx_pages_parent").on(t.parentId),
    index("idx_pages_channel").on(t.channelId),
  ],
);

/**
 * Pages a person has starred, so the sidebar can float them to the top.
 */
export const pageFavourites = pgTable(
  "page_favourites",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_page_favourites_user").on(t.userId, t.pageId)],
);
