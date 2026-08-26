import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { savedFolderItems } from "./saved-folder-item-schema";
import { channelTabs } from "./tab-schema";
import { channels } from "./schema";
import type { ChannelTabId, UserId, WorkspaceId } from "@openslaq/shared";

export async function saveFolderItem(userId: UserId, tabId: ChannelTabId, itemId: string) {
  await db
    .insert(savedFolderItems)
    .values({ userId, tabId, itemId })
    .onConflictDoNothing();
}

export async function unsaveFolderItem(userId: UserId, tabId: ChannelTabId, itemId: string): Promise<boolean> {
  const result = await db
    .delete(savedFolderItems)
    .where(
      and(
        eq(savedFolderItems.userId, userId),
        eq(savedFolderItems.tabId, tabId),
        eq(savedFolderItems.itemId, itemId),
      ),
    )
    .returning({ itemId: savedFolderItems.itemId });
  return result.length > 0;
}

/** Ids saved by this user within one tab — used to light up the folder UI. */
export async function listSavedItemIdsForTab(userId: UserId, tabId: ChannelTabId) {
  const rows = await db
    .select({ itemId: savedFolderItems.itemId })
    .from(savedFolderItems)
    .where(and(eq(savedFolderItems.userId, userId), eq(savedFolderItems.tabId, tabId)));
  return rows.map((r) => r.itemId);
}

/**
 * Everything this user saved across a workspace, joined to the owning tab so
 * the Later view can resolve each entry from the tab's stored content.
 */
export async function listSavedFolderItems(userId: UserId, workspaceId: WorkspaceId) {
  return db
    .select({
      itemId: savedFolderItems.itemId,
      savedAt: savedFolderItems.savedAt,
      tabId: channelTabs.id,
      tabName: channelTabs.name,
      tabContent: channelTabs.content,
      channelId: channels.id,
      channelName: channels.name,
    })
    .from(savedFolderItems)
    .innerJoin(channelTabs, eq(savedFolderItems.tabId, channelTabs.id))
    .innerJoin(channels, eq(channelTabs.channelId, channels.id))
    .where(and(eq(savedFolderItems.userId, userId), eq(channels.workspaceId, workspaceId)))
    .orderBy(desc(savedFolderItems.savedAt));
}
