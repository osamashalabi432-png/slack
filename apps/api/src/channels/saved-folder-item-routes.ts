import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { WorkspaceMemberEnv } from "../workspaces/role-middleware";
import { rlRead } from "../rate-limit";
import { asChannelId, asChannelTabId } from "@openslaq/shared";
import type { FolderContent, FolderItem, SavedFolderItem } from "@openslaq/shared";
import { listSavedFolderItems } from "./saved-folder-item-service";
import { BEARER_SECURITY, jsonContent } from "../lib/openapi-helpers";
import { getWorkspaceMemberContext } from "../lib/context";

const folderItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["file", "link"]),
  name: z.string(),
  url: z.string(),
  mimeType: z.string().nullish(),
  size: z.number().nullish(),
  addedAt: z.string(),
});

const savedFolderItemSchema = z.object({
  item: folderItemSchema,
  tabId: z.string(),
  tabName: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  savedAt: z.string(),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Saved Files"],
  summary: "List saved folder items",
  description: "Returns folder entries the current user saved for later in this workspace.",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  responses: {
    200: jsonContent(z.object({ items: z.array(savedFolderItemSchema) }), "Saved folder items"),
  },
});

/** Pulls one entry out of a tab's stored folder body. */
function findItem(content: unknown, itemId: string): FolderItem | null {
  const items = (content as FolderContent | null)?.items;
  if (!Array.isArray(items)) return null;
  return items.find((i) => i.id === itemId) ?? null;
}

const app = new OpenAPIHono<WorkspaceMemberEnv>().openapi(listRoute, async (c) => {
  const { user, workspace } = getWorkspaceMemberContext(c);
  const rows = await listSavedFolderItems(user.id, workspace.id);

  const items: SavedFolderItem[] = [];
  for (const row of rows) {
    // The entry may have been removed from the folder since it was saved.
    const item = findItem(row.tabContent, row.itemId);
    if (!item) continue;
    items.push({
      item,
      tabId: asChannelTabId(row.tabId),
      tabName: row.tabName,
      channelId: asChannelId(row.channelId),
      channelName: row.channelName,
      savedAt: row.savedAt.toISOString(),
    });
  }

  return c.json({ items }, 200);
});

export default app;
