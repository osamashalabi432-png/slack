import { pgTable, text, timestamp, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { channelTabs } from "./tab-schema";
import { users } from "../users/schema";

/**
 * Per-user "save for later" marks on folder entries. The entry itself lives in
 * the tab's content JSON, so only its id is referenced here.
 */
export const savedFolderItems = pgTable(
  "saved_folder_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tabId: uuid("tab_id")
      .notNull()
      .references(() => channelTabs.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    savedAt: timestamp("saved_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tabId, t.itemId] }),
    index("idx_saved_folder_items_user").on(t.userId),
  ],
);
