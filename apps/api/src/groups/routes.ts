import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { requireRole, type WorkspaceMemberEnv } from "../workspaces/role-middleware";

import { rlRead, rlMemberManage } from "../rate-limit";
import { ROLES, asChannelId, asUserGroupId, asUserId, zChannelId, zUserGroupId } from "@openslaq/shared";
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMember,
  addGroupChannels,
  removeGroupChannel,
  sidebarSections,
} from "./service";
import { okSchema, errorSchema } from "../openapi/schemas";
import { BEARER_SECURITY, jsonBody, jsonContent } from "../lib/openapi-helpers";
import { getWorkspaceMemberContext } from "../lib/context";

const groupParam = z.object({ groupId: zUserGroupId() });
const memberParam = z.object({ groupId: zUserGroupId(), userId: z.string().min(1) });
const channelParam = z.object({ groupId: zUserGroupId(), channelId: zChannelId() });

const groupSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  handle: z.string(),
  purpose: z.string().nullable(),
  showAsSection: z.boolean(),
  memberCount: z.number(),
  channelCount: z.number(),
  isMember: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const groupDetailSchema = groupSchema.extend({
  members: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      email: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      addedAt: z.string(),
    }),
  ),
  channels: z.array(
    z.object({ channelId: z.string(), name: z.string(), isPrivate: z.boolean() }),
  ),
});

const sectionSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  channelIds: z.array(z.string()),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["User Groups"],
  summary: "List user groups in the workspace",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  responses: { 200: jsonContent(z.array(groupSchema), "User groups") },
});

const sectionsRoute = createRoute({
  method: "get",
  path: "/sections",
  tags: ["User Groups"],
  summary: "Sidebar sections for the groups the caller belongs to",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  responses: { 200: jsonContent(z.array(sectionSchema), "Sidebar sections") },
});

const detailRoute = createRoute({
  method: "get",
  path: "/:groupId",
  tags: ["User Groups"],
  summary: "Get a group with its members and channels",
  security: BEARER_SECURITY,
  middleware: [rlRead] as const,
  request: { params: groupParam },
  responses: {
    200: jsonContent(groupDetailSchema, "User group"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const createGroupRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["User Groups"],
  summary: "Create a user group",
  description:
    "Admins only. Any channel attached to the group becomes private — group membership is what grants access to it.",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: {
    body: jsonBody(
      z.object({
        name: z.string().min(1).max(80),
        handle: z.string().min(3).max(32),
        purpose: z.string().max(500).nullish(),
        showAsSection: z.boolean().optional(),
        channelIds: z.array(zChannelId()).max(100).optional(),
        memberIds: z.array(z.string().min(1)).max(500).optional(),
      }),
    ),
  },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    201: jsonContent(groupSchema, "Created group"),
    400: jsonContent(errorSchema, "Invalid name or handle"),
  },
});

const updateGroupRoute = createRoute({
  method: "patch",
  path: "/:groupId",
  tags: ["User Groups"],
  summary: "Rename a group or change its handle, purpose or sidebar setting",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: {
    params: groupParam,
    body: jsonBody(
      z.object({
        name: z.string().min(1).max(80).optional(),
        handle: z.string().min(3).max(32).optional(),
        purpose: z.string().max(500).nullish(),
        showAsSection: z.boolean().optional(),
      }),
    ),
  },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(groupDetailSchema, "Updated group"),
    400: jsonContent(errorSchema, "Invalid handle"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/:groupId",
  tags: ["User Groups"],
  summary: "Delete a group",
  description: "Its channels stay private with their current members; nothing is emptied.",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: { params: groupParam },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(okSchema, "Deleted"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const addMembersRoute = createRoute({
  method: "post",
  path: "/:groupId/members",
  tags: ["User Groups"],
  summary: "Add people to a group, joining them to its channels",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: {
    params: groupParam,
    body: jsonBody(z.object({ userIds: z.array(z.string().min(1)).min(1).max(500) })),
  },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(groupDetailSchema, "Updated group"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/:groupId/members/:userId",
  tags: ["User Groups"],
  summary: "Remove someone from a group and from the channels it grants",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: { params: memberParam },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(groupDetailSchema, "Updated group"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const addChannelsRoute = createRoute({
  method: "post",
  path: "/:groupId/channels",
  tags: ["User Groups"],
  summary: "Put channels under a group",
  description: "Public channels are made private, and every group member is added to them.",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: {
    params: groupParam,
    body: jsonBody(z.object({ channelIds: z.array(zChannelId()).min(1).max(100) })),
  },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(groupDetailSchema, "Updated group"),
    400: jsonContent(errorSchema, "Channel cannot belong to a group"),
    404: jsonContent(errorSchema, "Group or channel not found"),
  },
});

const removeChannelRoute = createRoute({
  method: "delete",
  path: "/:groupId/channels/:channelId",
  tags: ["User Groups"],
  summary: "Take a channel out of a group",
  description: "The channel stays private; members who only reached it through this group lose it.",
  security: BEARER_SECURITY,
  middleware: [rlMemberManage, requireRole(ROLES.ADMIN)] as const,
  request: { params: channelParam },
  responses: {
    403: jsonContent(errorSchema, "Admins only"),
    200: jsonContent(groupDetailSchema, "Updated group"),
    404: jsonContent(errorSchema, "Group not found"),
  },
});

const routes = new OpenAPIHono<WorkspaceMemberEnv>()
  .openapi(listRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    return c.json(await listGroups(workspace.id, asUserId(user.id)), 200);
  })
  .openapi(sectionsRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    return c.json(await sidebarSections(workspace.id, asUserId(user.id)), 200);
  })
  .openapi(detailRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId } = c.req.valid("param");
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  })
  .openapi(createGroupRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const body = c.req.valid("json");
    const group = await createGroup(workspace.id, asUserId(user.id), {
      name: body.name,
      handle: body.handle,
      purpose: body.purpose ?? null,
      showAsSection: body.showAsSection,
      channelIds: body.channelIds?.map((id) => asChannelId(id)),
      memberIds: body.memberIds?.map((id) => asUserId(id)),
    });
    return c.json(group, 201);
  })
  .openapi(updateGroupRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId } = c.req.valid("param");
    await updateGroup(workspace.id, groupId, c.req.valid("json"));
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  })
  .openapi(deleteGroupRoute, async (c) => {
    const { workspace } = getWorkspaceMemberContext(c);
    const { groupId } = c.req.valid("param");
    await deleteGroup(workspace.id, groupId);
    return c.json({ ok: true } as const, 200);
  })
  .openapi(addMembersRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId } = c.req.valid("param");
    const { userIds } = c.req.valid("json");
    await addGroupMembers(workspace.id, groupId, userIds.map((id) => asUserId(id)));
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  })
  .openapi(removeMemberRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId, userId } = c.req.valid("param");
    await removeGroupMember(workspace.id, groupId, asUserId(userId));
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  })
  .openapi(addChannelsRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId } = c.req.valid("param");
    const { channelIds } = c.req.valid("json");
    await addGroupChannels(workspace.id, groupId, channelIds.map((id) => asChannelId(id)));
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  })
  .openapi(removeChannelRoute, async (c) => {
    const { workspace, user } = getWorkspaceMemberContext(c);
    const { groupId, channelId } = c.req.valid("param");
    await removeGroupChannel(workspace.id, groupId, asChannelId(channelId));
    return c.json(await getGroup(workspace.id, groupId, asUserId(user.id)), 200);
  });

export default routes;
export { asUserGroupId };
