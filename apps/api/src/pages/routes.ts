import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { WorkspaceMemberEnv } from "../workspaces/role-middleware";
import { rlRead, rlCanvasSave, rlMemberManage } from "../rate-limit";
import { asPageId, asUserId, zPageId } from "@openslaq/shared";
import {
  listPages,
  getPage,
  createPage,
  updatePage,
  movePage,
  archivePage,
  setFavourite,
} from "./service";
import { okSchema, errorSchema } from "../openapi/schemas";
import { BEARER_SECURITY, jsonBody, jsonContent } from "../lib/openapi-helpers";
import { getWorkspaceMemberContext } from "../lib/context";
import { BadRequestError } from "../errors";

const pageParam = z.object({ pageId: zPageId() });

/** Page bodies are ProseMirror JSON — kept opaque here, but bounded. */
const contentSchema = z.record(z.string(), z.unknown());
const MAX_CONTENT_BYTES = 2_000_000;

const pageSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  icon: z.string().nullable(),
  coverUrl: z.string().nullable(),
  position: z.number(),
  restrictedToGroupId: z.string().nullable(),
  archived: z.boolean(),
  hasChildren: z.boolean(),
  isFavourite: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const pageDetailSchema = pageSchema.extend({
  content: contentSchema.nullable(),
  breadcrumbs: z.array(
    z.object({ id: z.string(), title: z.string(), icon: z.string().nullable() }),
  ),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Pages"],
  summary: "Every page in the workspace the caller may read, flat",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  responses: { 200: jsonContent(z.array(pageSchema), "Pages") },
});

const detailRoute = createRoute({
  method: "get",
  path: "/:pageId",
  tags: ["Pages"],
  summary: "A page with its body and the trail above it",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  request: { params: pageParam },
  responses: {
    200: jsonContent(pageDetailSchema, "Page"),
    403: jsonContent(errorSchema, "Restricted to a group you are not in"),
    404: jsonContent(errorSchema, "Page not found"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  tags: ["Pages"],
  summary: "Create a page, optionally inside another",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave] as const,
  request: {
    body: jsonBody(
      z.object({
        parentId: zPageId().nullish(),
        title: z.string().max(200).optional(),
        icon: z.string().max(200).nullish(),
      }),
    ),
  },
  responses: {
    201: jsonContent(pageSchema, "Created page"),
    403: jsonContent(errorSchema, "Parent is restricted"),
    404: jsonContent(errorSchema, "Parent not found"),
  },
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/:pageId",
  tags: ["Pages"],
  summary: "Change a page's title, icon, cover, body or group restriction",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave] as const,
  request: {
    params: pageParam,
    body: jsonBody(
      z.object({
        title: z.string().max(200).optional(),
        icon: z.string().max(200).nullish(),
        coverUrl: z.string().max(2000).nullish(),
        content: contentSchema.optional(),
        restrictedToGroupId: z.string().nullish(),
      }),
    ),
  },
  responses: {
    200: jsonContent(pageDetailSchema, "Updated page"),
    400: jsonContent(errorSchema, "Body too large"),
    403: jsonContent(errorSchema, "Restricted"),
    404: jsonContent(errorSchema, "Page not found"),
  },
});

const moveRoute = createRoute({
  method: "post",
  path: "/:pageId/move",
  tags: ["Pages"],
  summary: "Move a page, carrying everything under it",
  description: "A page cannot be moved inside one of its own sub-pages.",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave] as const,
  request: {
    params: pageParam,
    body: jsonBody(z.object({ parentId: zPageId().nullable(), position: z.number().optional() })),
  },
  responses: {
    200: jsonContent(okSchema, "Moved"),
    400: jsonContent(errorSchema, "Would detach the page from the tree"),
    403: jsonContent(errorSchema, "Restricted"),
    404: jsonContent(errorSchema, "Page not found"),
  },
});

const archiveRoute = createRoute({
  method: "post",
  path: "/:pageId/archive",
  tags: ["Pages"],
  summary: "Archive or restore a page and everything under it",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage] as const,
  request: {
    params: pageParam,
    body: jsonBody(z.object({ archived: z.boolean() })),
  },
  responses: {
    200: jsonContent(okSchema, "Archived"),
    403: jsonContent(errorSchema, "Restricted"),
    404: jsonContent(errorSchema, "Page not found"),
  },
});

const favouriteRoute = createRoute({
  method: "post",
  path: "/:pageId/favourite",
  tags: ["Pages"],
  summary: "Star or unstar a page",
  security: BEARER_SECURITY,
  middleware: [rlCanvasSave] as const,
  request: {
    params: pageParam,
    body: jsonBody(z.object({ favourite: z.boolean() })),
  },
  responses: {
    200: jsonContent(okSchema, "Updated"),
    403: jsonContent(errorSchema, "Restricted"),
    404: jsonContent(errorSchema, "Page not found"),
  },
});

const routes = new OpenAPIHono<WorkspaceMemberEnv>()
  .openapi(listRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    return c.json(await listPages(workspace.id, asUserId(user.id)), 200);
  })
  .openapi(detailRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { pageId } = c.req.valid("param");
    return c.json(await getPage(workspace.id, pageId, asUserId(user.id)), 200);
  })
  .openapi(createRouteDef, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const body = c.req.valid("json");
    const page = await createPage(workspace.id, asUserId(user.id), {
      parentId: body.parentId ? asPageId(body.parentId) : null,
      title: body.title,
      icon: body.icon ?? null,
    });
    return c.json(page, 201);
  })
  .openapi(updateRouteDef, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { pageId } = c.req.valid("param");
    const body = c.req.valid("json");

    if (body.content && JSON.stringify(body.content).length > MAX_CONTENT_BYTES) {
      throw new BadRequestError("Page body is too large");
    }

    await updatePage(workspace.id, pageId, asUserId(user.id), {
      title: body.title,
      icon: body.icon,
      coverUrl: body.coverUrl,
      content: body.content,
      restrictedToGroupId: body.restrictedToGroupId,
    });
    return c.json(await getPage(workspace.id, pageId, asUserId(user.id)), 200);
  })
  .openapi(moveRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { pageId } = c.req.valid("param");
    const body = c.req.valid("json");
    await movePage(workspace.id, pageId, asUserId(user.id), {
      parentId: body.parentId ? asPageId(body.parentId) : null,
      position: body.position,
    });
    return c.json({ ok: true } as const, 200);
  })
  .openapi(archiveRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { pageId } = c.req.valid("param");
    await archivePage(workspace.id, pageId, asUserId(user.id), c.req.valid("json").archived);
    return c.json({ ok: true } as const, 200);
  })
  .openapi(favouriteRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { pageId } = c.req.valid("param");
    await setFavourite(workspace.id, pageId, asUserId(user.id), c.req.valid("json").favourite);
    return c.json({ ok: true } as const, 200);
  });

export default routes;
