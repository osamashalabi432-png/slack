import { boolean, index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "../workspaces/schema";
import { channels } from "../channels/schema";
import { users } from "../users/schema";

/**
 * A team with a roster and a set of channels. Membership is the access rule:
 * the group's channels are private, and being in the group is what puts you in
 * them.
 */
export const userGroups = pgTable(
  "user_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Lowercase handle used for `@mentions`; unique inside a workspace. */
    handle: text("handle").notNull(),
    purpose: text("purpose"),
    showAsSection: boolean("show_as_section").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.handle),
    index("idx_user_groups_workspace").on(t.workspaceId),
  ],
);

export const userGroupMembers = pgTable(
  "user_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("idx_user_group_members_user").on(t.userId),
  ],
);

export const userGroupChannels = pgTable(
  "user_group_channels",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.channelId] }),
    index("idx_user_group_channels_channel").on(t.channelId),
  ],
);
