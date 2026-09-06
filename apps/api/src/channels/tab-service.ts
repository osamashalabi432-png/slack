import { eq, and, asc, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { channelTabs } from "./tab-schema";
import { emitToChannel } from "../lib/emit";
import { asChannelId, asChannelTabId, asUserId } from "@openslaq/shared";
import type {
  CanvasContent,
  ChannelId,
  ChannelTab,
  ChannelTabId,
  ChannelTabType,
  UserId,
} from "@openslaq/shared";

type TabRow = typeof channelTabs.$inferSelect;

export function serializeTab(row: TabRow): ChannelTab {
  return {
    id: asChannelTabId(row.id),
    channelId: asChannelId(row.channelId),
    type: row.type as ChannelTabType,
    name: row.name,
    position: row.position,
    createdBy: asUserId(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ? asUserId(row.updatedBy) : null,
  };
}

/**
 * Keep a canvas tab's label in step with the title of the page behind it, so
 * renaming the document in the editor renames the tab. No-op when the page
 * backs no tab, or the name already matches.
 */
export async function syncTabNameForPage(pageId: string, name: string): Promise<void> {
  const trimmed = name.trim() || "Untitled";
  const [row] = await db
    .update(channelTabs)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(channelTabs.pageId, pageId), ne(channelTabs.name, trimmed)))
    .returning();
  if (row) emitToChannel(asChannelId(row.channelId), "tab:updated", { tab: serializeTab(row) });
}

export async function listTabs(channelId: ChannelId) {
  return db
    .select({
      id: channelTabs.id,
      channelId: channelTabs.channelId,
      type: channelTabs.type,
      name: channelTabs.name,
      position: channelTabs.position,
      createdBy: channelTabs.createdBy,
      createdAt: channelTabs.createdAt,
      updatedAt: channelTabs.updatedAt,
      updatedBy: channelTabs.updatedBy,
    })
    .from(channelTabs)
    .where(eq(channelTabs.channelId, channelId))
    .orderBy(asc(channelTabs.position), asc(channelTabs.createdAt));
}

export async function getTab(channelId: ChannelId, tabId: ChannelTabId) {
  const [row] = await db
    .select()
    .from(channelTabs)
    .where(and(eq(channelTabs.id, tabId), eq(channelTabs.channelId, channelId)));
  return row ?? null;
}

export async function createTab(
  channelId: ChannelId,
  type: ChannelTabType,
  name: string,
  createdBy: UserId,
) {
  // Append to the end of the existing strip.
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${channelTabs.position}), -1) + 1` })
    .from(channelTabs)
    .where(eq(channelTabs.channelId, channelId));

  const [row] = await db
    .insert(channelTabs)
    .values({ channelId, type, name, position: next, createdBy, content: null })
    .returning();
  return row!;
}

export async function renameTab(channelId: ChannelId, tabId: ChannelTabId, name: string) {
  const [row] = await db
    .update(channelTabs)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(channelTabs.id, tabId), eq(channelTabs.channelId, channelId)))
    .returning();
  return row ?? null;
}

/**
 * Set every tab's `position` from its index in `orderedIds`. Returns null (and
 * changes nothing) unless `orderedIds` is exactly this channel's tab set — a
 * partial or foreign list is a client bug, not a reorder.
 */
export async function reorderTabs(channelId: ChannelId, orderedIds: ChannelTabId[]) {
  const current = await listTabs(channelId);
  const currentIds = new Set<string>(current.map((t) => t.id));
  const unique = new Set<string>(orderedIds);
  if (unique.size !== orderedIds.length || orderedIds.length !== current.length) return null;
  if (orderedIds.some((id) => !currentIds.has(id))) return null;

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(channelTabs)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(channelTabs.id, orderedIds[i]!), eq(channelTabs.channelId, channelId)));
    }
  });

  return listTabs(channelId);
}

export async function saveCanvasContent(
  channelId: ChannelId,
  tabId: ChannelTabId,
  content: CanvasContent,
  updatedBy: UserId,
) {
  const [row] = await db
    .update(channelTabs)
    .set({ content, updatedBy, updatedAt: new Date() })
    .where(and(eq(channelTabs.id, tabId), eq(channelTabs.channelId, channelId)))
    .returning();
  return row ?? null;
}

export async function deleteTab(channelId: ChannelId, tabId: ChannelTabId): Promise<boolean> {
  const result = await db
    .delete(channelTabs)
    .where(and(eq(channelTabs.id, tabId), eq(channelTabs.channelId, channelId)))
    .returning({ id: channelTabs.id });
  return result.length > 0;
}
