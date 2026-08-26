import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { resolveChannel, requireChannelMember } from "./middleware";
import type { WorkspaceMemberEnv } from "../workspaces/role-middleware";
import { rlRead, rlMemberManage, rlCanvasSave } from "../rate-limit";
import {
  asChannelId,
  asChannelTabId,
  asUserId,
  zChannelId,
  DB_PROPERTY_TYPES,
  DB_VIEW_TYPES,
  DB_OPTION_COLORS,
  DATABASE_PRESETS,
} from "@openslaq/shared";
import type {
  CanvasDatabase,
  CanvasDatabaseRow,
  ChannelId,
  DbProperty,
  DbRowValues,
  DbView,
} from "@openslaq/shared";
import {
  createDatabase,
  getDatabase,
  listRows,
  updateDatabase,
  createRow,
  updateRow,
  deleteRow,
} from "./canvas-database-service";
import { emitToChannel } from "../lib/emit";
import { okSchema, errorSchema } from "../openapi/schemas";
import { BadRequestError, NotFoundError } from "../errors";
import { BEARER_SECURITY, jsonBody, jsonContent } from "../lib/openapi-helpers";
import { getChannelContext } from "../lib/context";

const channelIdParam = z.object({ id: zChannelId() });
const dbParams = z.object({ id: zChannelId(), databaseId: z.string() });
const rowParams = z.object({ id: zChannelId(), databaseId: z.string(), rowId: z.string() });

const optionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  color: z.enum(DB_OPTION_COLORS),
});

const propertySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  type: z.enum(DB_PROPERTY_TYPES),
  options: z.array(optionSchema).max(40).optional(),
});

const viewSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  type: z.enum(DB_VIEW_TYPES),
  groupByPropertyId: z.string().max(64).nullish(),
  datePropertyId: z.string().max(64).nullish(),
});

const rowValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const databaseSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  tabId: z.string().nullable(),
  name: z.string(),
  properties: z.array(propertySchema),
  views: z.array(viewSchema),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const rowSchema = z.object({
  id: z.string(),
  databaseId: z.string(),
  position: z.number(),
  values: rowValuesSchema,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

interface DbRecord {
  id: string;
  channelId: string;
  tabId: string | null;
  name: string;
  properties: DbProperty[];
  views: DbView[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RowRecord {
  id: string;
  databaseId: string;
  position: number;
  values: DbRowValues;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDatabase(row: DbRecord): CanvasDatabase {
  return {
    id: row.id,
    channelId: asChannelId(row.channelId),
    tabId: row.tabId ? asChannelTabId(row.tabId) : null,
    name: row.name,
    properties: row.properties,
    views: row.views,
    createdBy: asUserId(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(row: RowRecord): CanvasDatabaseRow {
  return {
    id: row.id,
    databaseId: row.databaseId,
    position: row.position,
    values: row.values,
    createdBy: asUserId(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const createDatabaseRoute = createRoute({
  method: "post",
  path: "/:id/databases",
  tags: ["Canvas Databases"],
  summary: "Create a database block",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: {
    params: channelIdParam,
    body: jsonBody(
      z.object({
        name: z.string().min(1).max(80),
        tabId: z.string().nullish(),
        preset: z.enum(DATABASE_PRESETS).optional(),
      }),
    ),
  },
  responses: {
    201: jsonContent(databaseSchema, "Created database"),
    400: jsonContent(errorSchema, "Channel is archived"),
  },
});

const getDatabaseRoute = createRoute({
  method: "get",
  path: "/:id/databases/:databaseId",
  tags: ["Canvas Databases"],
  summary: "Get a database with its rows",
  security: BEARER_SECURITY,
  middleware: [rlRead, resolveChannel, requireChannelMember] as const,
  request: { params: dbParams },
  responses: {
    200: jsonContent(z.object({ database: databaseSchema, rows: z.array(rowSchema) }), "Database"),
    404: jsonContent(errorSchema, "Database not found"),
  },
});

const updateDatabaseRoute = createRoute({
  method: "patch",
  path: "/:id/databases/:databaseId",
  tags: ["Canvas Databases"],
  summary: "Update database name, properties or views",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave, resolveChannel, requireChannelMember] as const,
  request: {
    params: dbParams,
    body: jsonBody(
      z.object({
        name: z.string().min(1).max(80).optional(),
        properties: z.array(propertySchema).max(40).optional(),
        views: z.array(viewSchema).max(20).optional(),
      }),
    ),
  },
  responses: {
    200: jsonContent(databaseSchema, "Updated database"),
    400: jsonContent(errorSchema, "Invalid database payload"),
    404: jsonContent(errorSchema, "Database not found"),
  },
});

const createRowRoute = createRoute({
  method: "post",
  path: "/:id/databases/:databaseId/rows",
  tags: ["Canvas Databases"],
  summary: "Add a row",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave, resolveChannel, requireChannelMember] as const,
  request: {
    params: dbParams,
    body: jsonBody(z.object({ values: rowValuesSchema })),
  },
  responses: {
    201: jsonContent(rowSchema, "Created row"),
    404: jsonContent(errorSchema, "Database not found"),
  },
});

const updateRowRoute = createRoute({
  method: "patch",
  path: "/:id/databases/:databaseId/rows/:rowId",
  tags: ["Canvas Databases"],
  summary: "Update row values or position",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave, resolveChannel, requireChannelMember] as const,
  request: {
    params: rowParams,
    body: jsonBody(
      z.object({
        values: rowValuesSchema.optional(),
        position: z.number().int().min(0).optional(),
      }),
    ),
  },
  responses: {
    200: jsonContent(rowSchema, "Updated row"),
    404: jsonContent(errorSchema, "Row not found"),
  },
});

const deleteRowRoute = createRoute({
  method: "delete",
  path: "/:id/databases/:databaseId/rows/:rowId",
  tags: ["Canvas Databases"],
  summary: "Delete a row",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: { params: rowParams },
  responses: {
    200: jsonContent(okSchema, "Row deleted"),
    404: jsonContent(errorSchema, "Row not found"),
  },
});

/** Ensures the database belongs to this channel before touching its rows. */
async function requireDatabase(channelId: ChannelId, databaseId: string) {
  const database = await getDatabase(channelId, databaseId);
  if (!database) throw new NotFoundError("Database");
  return database;
}

const app = new OpenAPIHono<WorkspaceMemberEnv>()
  .openapi(createDatabaseRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { name, tabId, preset } = c.req.valid("json");
    const record = await createDatabase(
      channel.id,
      tabId ? asChannelTabId(tabId) : null,
      name,
      user.id,
      preset ?? "full",
    );
    const database = toDatabase(record);

    emitToChannel(channel.id, "database:updated", { channelId: channel.id, database });

    return c.json(database, 201);
  })
  .openapi(getDatabaseRoute, async (c) => {
    const { channel } = getChannelContext(c);
    const { databaseId } = c.req.valid("param");

    const record = await requireDatabase(channel.id, databaseId);
    const rows = await listRows(databaseId);

    return c.json({ database: toDatabase(record), rows: rows.map(toRow) }, 200);
  })
  .openapi(updateDatabaseRoute, async (c) => {
    const { channel } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { databaseId } = c.req.valid("param");
    const patch = c.req.valid("json");

    const record = await updateDatabase(channel.id, databaseId, patch as {
      name?: string;
      properties?: DbProperty[];
      views?: DbView[];
    });
    if (!record) throw new NotFoundError("Database");

    const database = toDatabase(record);
    emitToChannel(channel.id, "database:updated", { channelId: channel.id, database });

    return c.json(database, 200);
  })
  .openapi(createRowRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { databaseId } = c.req.valid("param");
    await requireDatabase(channel.id, databaseId);

    const { values } = c.req.valid("json");
    const row = toRow(await createRow(databaseId, values, user.id));

    emitToChannel(channel.id, "database:rowUpserted", { channelId: channel.id, databaseId, row });

    return c.json(row, 201);
  })
  .openapi(updateRowRoute, async (c) => {
    const { channel } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { databaseId, rowId } = c.req.valid("param");
    await requireDatabase(channel.id, databaseId);

    const patch = c.req.valid("json");
    const updated = await updateRow(databaseId, rowId, patch);
    if (!updated) throw new NotFoundError("Row");

    const row = toRow(updated);
    emitToChannel(channel.id, "database:rowUpserted", { channelId: channel.id, databaseId, row });

    return c.json(row, 200);
  })
  .openapi(deleteRowRoute, async (c) => {
    const { channel } = getChannelContext(c);
    const { databaseId, rowId } = c.req.valid("param");
    await requireDatabase(channel.id, databaseId);

    const removed = await deleteRow(databaseId, rowId);
    if (!removed) throw new NotFoundError("Row");

    emitToChannel(channel.id, "database:rowRemoved", { channelId: channel.id, databaseId, rowId });

    return c.json({ ok: true as const }, 200);
  });

export default app;
