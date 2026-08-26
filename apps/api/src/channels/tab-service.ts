import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "../db";
import { channelTabs } from "./tab-schema";
import type { CanvasContent, ChannelId, ChannelTabId, ChannelTabType, UserId } from "@openslaq/shared";

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
