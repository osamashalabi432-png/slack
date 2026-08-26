import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { resolveChannel, requireChannelMember } from "./middleware";
import type { WorkspaceMemberEnv } from "../workspaces/role-middleware";
import { rlRead, rlMemberManage, rlCanvasSave } from "../rate-limit";
import {
  asChannelId,
  asChannelTabId,
  asUserId,
  zChannelId,
  zChannelTabId,
  CHANNEL_TAB_TYPES,
} from "@openslaq/shared";
import type { CanvasContent, ChannelTab, ChannelTabType } from "@openslaq/shared";
import { listTabs, getTab, createTab, renameTab, saveCanvasContent, deleteTab } from "./tab-service";
import {
  saveFolderItem,
  unsaveFolderItem,
  listSavedItemIdsForTab,
} from "./saved-folder-item-service";
import { emitToChannel } from "../lib/emit";
import { okSchema, errorSchema } from "../openapi/schemas";
import { BadRequestError, NotFoundError } from "../errors";
import { BEARER_SECURITY, jsonBody, jsonContent } from "../lib/openapi-helpers";
import { getChannelContext } from "../lib/context";
import { ensureTabPage } from "../pages/service";

const channelIdParam = z.object({ id: zChannelId() });
const tabParams = z.object({ id: zChannelId(), tabId: zChannelTabId() });
const itemParams = z.object({
  id: zChannelId(),
  tabId: zChannelTabId(),
  itemId: z.string().min(1).max(200),
});

/** Canvas bodies are ProseMirror JSON — kept opaque, but bounded. */
const canvasContentSchema = z.record(z.string(), z.unknown());
const MAX_CANVAS_BYTES = 1_000_000;

const tabSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  type: z.string(),
  name: z.string(),
  position: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

const tabWithContentSchema = tabSchema.extend({
  content: canvasContentSchema.nullable(),
});

const listTabsRoute = createRoute({
  method: "get",
  path: "/:id/tabs",
  tags: ["Channel Tabs"],
  summary: "List channel tabs",
  security: BEARER_SECURITY,
  middleware: [rlRead, resolveChannel, requireChannelMember] as const,
  request: { params: channelIdParam },
  responses: {
    200: jsonContent(z.object({ tabs: z.array(tabSchema) }), "List of tabs"),
  },
});

const getTabRoute = createRoute({
  method: "get",
  path: "/:id/tabs/:tabId",
  tags: ["Channel Tabs"],
  summary: "Get a channel tab with its content",
  security: BEARER_SECURITY,
  middleware: [rlRead, resolveChannel, requireChannelMember] as const,
  request: { params: tabParams },
  responses: {
    200: jsonContent(tabWithContentSchema, "Tab with content"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const createTabRoute = createRoute({
  method: "post",
  path: "/:id/tabs",
  tags: ["Channel Tabs"],
  summary: "Add a tab to a channel",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: {
    params: channelIdParam,
    body: jsonBody(
      z.object({
        type: z.enum(CHANNEL_TAB_TYPES),
        name: z.string().min(1).max(80),
      }),
    ),
  },
  responses: {
    201: jsonContent(tabSchema, "Created tab"),
    400: jsonContent(errorSchema, "Validation error or channel is archived"),
  },
});

const renameTabRoute = createRoute({
  method: "patch",
  path: "/:id/tabs/:tabId",
  tags: ["Channel Tabs"],
  summary: "Rename a channel tab",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: {
    params: tabParams,
    body: jsonBody(z.object({ name: z.string().min(1).max(80) })),
  },
  responses: {
    200: jsonContent(tabSchema, "Updated tab"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const saveContentRoute = createRoute({
  method: "put",
  path: "/:id/tabs/:tabId/content",
  tags: ["Channel Tabs"],
  summary: "Save canvas content",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave, resolveChannel, requireChannelMember] as const,
  request: {
    params: tabParams,
    body: jsonBody(z.object({ content: canvasContentSchema })),
  },
  responses: {
    200: jsonContent(z.object({ updatedAt: z.string() }), "Content saved"),
    400: jsonContent(errorSchema, "Content too large or channel is archived"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const deleteTabRoute = createRoute({
  method: "delete",
  path: "/:id/tabs/:tabId",
  tags: ["Channel Tabs"],
  summary: "Remove a channel tab",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: { params: tabParams },
  responses: {
    200: jsonContent(okSchema, "Tab removed"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const savedIdsRoute = createRoute({
  method: "get",
  path: "/:id/tabs/:tabId/saved-items",
  tags: ["Channel Tabs"],
  summary: "List folder entries the caller saved for later",
  security: BEARER_SECURITY,
  middleware: [rlRead, resolveChannel, requireChannelMember] as const,
  request: { params: tabParams },
  responses: {
    200: jsonContent(z.object({ itemIds: z.array(z.string()) }), "Saved entry ids"),
  },
});

const saveItemRoute = createRoute({
  method: "put",
  path: "/:id/tabs/:tabId/items/:itemId/save",
  tags: ["Channel Tabs"],
  summary: "Save a folder entry for later",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: { params: itemParams },
  responses: {
    200: jsonContent(okSchema, "Saved"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const unsaveItemRoute = createRoute({
  method: "delete",
  path: "/:id/tabs/:tabId/items/:itemId/save",
  tags: ["Channel Tabs"],
  summary: "Remove a folder entry from the caller's Later list",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, resolveChannel, requireChannelMember] as const,
  request: { params: itemParams },
  responses: {
    200: jsonContent(okSchema, "Removed"),
    404: jsonContent(errorSchema, "Not saved"),
  },
});

interface TabRow {
  id: string;
  channelId: string;
  type: string;
  name: string;
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
}

function toTabResponse(row: TabRow): ChannelTab {
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
 * A canvas tab is a page. This hands back the page behind it, creating it on
 * first open and carrying over anything the old canvas held.
 */
const tabPageRoute = createRoute({
  method: "post",
  path: "/:id/tabs/:tabId/page",
  tags: ["Channel Tabs"],
  summary: "Get (or create) the page behind a canvas tab",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave, resolveChannel, requireChannelMember] as const,
  request: { params: tabParams },
  responses: {
    200: jsonContent(z.object({ pageId: z.string() }), "The tab's page"),
    404: jsonContent(errorSchema, "Tab not found"),
  },
});

const app = new OpenAPIHono<WorkspaceMemberEnv>()
  .openapi(tabPageRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    const { tabId } = c.req.valid("param");
    const pageId = await ensureTabPage(
      channel.workspaceId,
      channel.id,
      tabId,
      asUserId(user.id),
    );
    return c.json({ pageId: pageId as string }, 200);
  })
  .openapi(listTabsRoute, async (c) => {
    const { channel } = getChannelContext(c);
    const rows = await listTabs(channel.id);
    return c.json({ tabs: rows.map(toTabResponse) }, 200);
  })
  .openapi(getTabRoute, async (c) => {
    const { channel } = getChannelContext(c);
    const { tabId } = c.req.valid("param");

    const row = await getTab(channel.id, tabId);
    if (!row) throw new NotFoundError("Tab");

    return c.json({ ...toTabResponse(row), content: row.content ?? null }, 200);
  })
  .openapi(createTabRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { type, name } = c.req.valid("json");
    const row = await createTab(channel.id, type, name, user.id);
    const tab = toTabResponse(row);

    emitToChannel(channel.id, "tab:created", { tab });

    return c.json(tab, 201);
  })
  .openapi(renameTabRoute, async (c) => {
    const { channel } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { tabId } = c.req.valid("param");
    const { name } = c.req.valid("json");

    const row = await renameTab(channel.id, tabId, name);
    if (!row) throw new NotFoundError("Tab");

    const tab = toTabResponse(row);
    emitToChannel(channel.id, "tab:updated", { tab });

    return c.json(tab, 200);
  })
  .openapi(saveContentRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    if (channel.isArchived) throw new BadRequestError("Channel is archived");

    const { tabId } = c.req.valid("param");
    const { content } = c.req.valid("json");

    if (JSON.stringify(content).length > MAX_CANVAS_BYTES) {
      throw new BadRequestError("Canvas content is too large");
    }

    const row = await saveCanvasContent(channel.id, tabId, content as CanvasContent, user.id);
    if (!row) throw new NotFoundError("Tab");

    const updatedAt = row.updatedAt.toISOString();
    emitToChannel(channel.id, "canvas:updated", {
      channelId: channel.id,
      tabId: asChannelTabId(row.id),
      updatedBy: user.id,
      updatedAt,
    });

    return c.json({ updatedAt }, 200);
  })
  .openapi(savedIdsRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    const { tabId } = c.req.valid("param");

    const tab = await getTab(channel.id, tabId);
    if (!tab) throw new NotFoundError("Tab");

    const itemIds = await listSavedItemIdsForTab(user.id, tabId);
    return c.json({ itemIds }, 200);
  })
  .openapi(saveItemRoute, async (c) => {
    const { channel, user } = getChannelContext(c);
    const { tabId, itemId } = c.req.valid("param");

    const tab = await getTab(channel.id, tabId);
    if (!tab) throw new NotFoundError("Tab");

    await saveFolderItem(user.id, tabId, itemId);
    return c.json({ ok: true as const }, 200);
  })
  .openapi(unsaveItemRoute, async (c) => {
    const { user } = getChannelContext(c);
    const { tabId, itemId } = c.req.valid("param");

    const removed = await unsaveFolderItem(user.id, tabId, itemId);
    if (!removed) throw new NotFoundError("Saved entry");

    return c.json({ ok: true as const }, 200);
  })
  .openapi(deleteTabRoute, async (c) => {
    const { channel } = getChannelContext(c);
    const { tabId } = c.req.valid("param");

    const removed = await deleteTab(channel.id, tabId);
    if (!removed) throw new NotFoundError("Tab");

    emitToChannel(channel.id, "tab:removed", { channelId: channel.id, tabId });

    return c.json({ ok: true as const }, 200);
  });

export default app;
