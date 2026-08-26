import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "../db";
import { canvasDatabases, canvasDatabaseRows } from "./canvas-database-schema";
import { databaseSchemaForPreset } from "@openslaq/shared";
import type {
  ChannelId,
  ChannelTabId,
  DatabasePreset,
  DbProperty,
  DbRowValues,
  DbView,
  UserId,
} from "@openslaq/shared";

export async function createDatabase(
  channelId: ChannelId,
  tabId: ChannelTabId | null,
  name: string,
  createdBy: UserId,
  preset: DatabasePreset = "full",
) {
  const { properties, views } = databaseSchemaForPreset(preset);
  const [row] = await db
    .insert(canvasDatabases)
    .values({ channelId, tabId, name, properties, views, createdBy })
    .returning();
  return row!;
}

export async function getDatabase(channelId: ChannelId, databaseId: string) {
  const [row] = await db
    .select()
    .from(canvasDatabases)
    .where(and(eq(canvasDatabases.id, databaseId), eq(canvasDatabases.channelId, channelId)));
  return row ?? null;
}

export async function listRows(databaseId: string) {
  return db
    .select()
    .from(canvasDatabaseRows)
    .where(eq(canvasDatabaseRows.databaseId, databaseId))
    .orderBy(asc(canvasDatabaseRows.position), asc(canvasDatabaseRows.createdAt));
}

export async function updateDatabase(
  channelId: ChannelId,
  databaseId: string,
  patch: { name?: string; properties?: DbProperty[]; views?: DbView[] },
) {
  const [row] = await db
    .update(canvasDatabases)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(canvasDatabases.id, databaseId), eq(canvasDatabases.channelId, channelId)))
    .returning();
  return row ?? null;
}

export async function createRow(databaseId: string, values: DbRowValues, createdBy: UserId) {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${canvasDatabaseRows.position}), -1) + 1` })
    .from(canvasDatabaseRows)
    .where(eq(canvasDatabaseRows.databaseId, databaseId));

  const [row] = await db
    .insert(canvasDatabaseRows)
    .values({ databaseId, values, position: next, createdBy })
    .returning();
  return row!;
}

export async function updateRow(
  databaseId: string,
  rowId: string,
  patch: { values?: DbRowValues; position?: number },
) {
  const [row] = await db
    .update(canvasDatabaseRows)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(canvasDatabaseRows.id, rowId), eq(canvasDatabaseRows.databaseId, databaseId)))
    .returning();
  return row ?? null;
}

export async function deleteRow(databaseId: string, rowId: string): Promise<boolean> {
  const result = await db
    .delete(canvasDatabaseRows)
    .where(and(eq(canvasDatabaseRows.id, rowId), eq(canvasDatabaseRows.databaseId, databaseId)))
    .returning({ id: canvasDatabaseRows.id });
  return result.length > 0;
}
