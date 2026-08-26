import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { userGroups, userGroupMembers, userGroupChannels } from "./schema";
import { channels } from "../channels/schema";
import { users } from "../users/schema";
import { addChannelMembersBulk, removeChannelMember } from "../channels/service";
import { BadRequestError, NotFoundError } from "../errors";
import type {
  ChannelId,
  UserGroup,
  UserGroupDetail,
  UserGroupId,
  UserId,
  SidebarGroupSection,
} from "@openslaq/shared";
import { asChannelId, asUserGroupId, asUserId, isValidGroupHandle } from "@openslaq/shared";

/**
 * Channels a user reaches through some group other than `exceptGroupId`.
 *
 * Membership is granted by groups, so it must only be taken away when no
 * remaining group still grants it — otherwise removing someone from Marketing
 * would also throw them out of a channel Sales owns.
 */
async function channelsHeldViaOtherGroups(
  userId: UserId,
  exceptGroupId: UserGroupId,
): Promise<Set<string>> {
  const rows = await db
    .select({ channelId: userGroupChannels.channelId })
    .from(userGroupChannels)
    .innerJoin(userGroupMembers, eq(userGroupMembers.groupId, userGroupChannels.groupId))
    .where(
      and(
        eq(userGroupMembers.userId, userId),
        sql`${userGroupChannels.groupId} <> ${exceptGroupId}`,
      ),
    );
  return new Set(rows.map((r) => r.channelId));
}

function toGroup(
  row: typeof userGroups.$inferSelect,
  memberCount: number,
  channelCount: number,
  isMember: boolean,
): UserGroup {
  return {
    id: asUserGroupId(row.id),
    workspaceId: row.workspaceId,
    name: row.name,
    handle: row.handle,
    purpose: row.purpose,
    showAsSection: row.showAsSection,
    memberCount,
    channelCount,
    isMember,
    createdBy: row.createdBy ? asUserId(row.createdBy) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGroups(workspaceId: string, viewerId: UserId): Promise<UserGroup[]> {
  const rows = await db
    .select()
    .from(userGroups)
    .where(eq(userGroups.workspaceId, workspaceId))
    .orderBy(userGroups.name);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [memberRows, channelRows, mineRows] = await Promise.all([
    db
      .select({ groupId: userGroupMembers.groupId, count: sql<number>`count(*)::int` })
      .from(userGroupMembers)
      .where(inArray(userGroupMembers.groupId, ids))
      .groupBy(userGroupMembers.groupId),
    db
      .select({ groupId: userGroupChannels.groupId, count: sql<number>`count(*)::int` })
      .from(userGroupChannels)
      .where(inArray(userGroupChannels.groupId, ids))
      .groupBy(userGroupChannels.groupId),
    db
      .select({ groupId: userGroupMembers.groupId })
      .from(userGroupMembers)
      .where(and(inArray(userGroupMembers.groupId, ids), eq(userGroupMembers.userId, viewerId))),
  ]);

  const members = new Map(memberRows.map((r) => [r.groupId, r.count]));
  const channelCounts = new Map(channelRows.map((r) => [r.groupId, r.count]));
  const mine = new Set(mineRows.map((r) => r.groupId));

  return rows.map((row) =>
    toGroup(row, members.get(row.id) ?? 0, channelCounts.get(row.id) ?? 0, mine.has(row.id)),
  );
}

async function requireGroup(workspaceId: string, groupId: UserGroupId) {
  const [row] = await db
    .select()
    .from(userGroups)
    .where(and(eq(userGroups.id, groupId), eq(userGroups.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("User group");
  return row;
}

export async function getGroup(
  workspaceId: string,
  groupId: UserGroupId,
  viewerId: UserId,
): Promise<UserGroupDetail> {
  const row = await requireGroup(workspaceId, groupId);

  const [memberRows, channelRows] = await Promise.all([
    db
      .select({
        userId: userGroupMembers.userId,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        addedAt: userGroupMembers.addedAt,
      })
      .from(userGroupMembers)
      .innerJoin(users, eq(users.id, userGroupMembers.userId))
      .where(eq(userGroupMembers.groupId, groupId))
      .orderBy(users.displayName),
    db
      .select({ channelId: userGroupChannels.channelId, name: channels.name, type: channels.type })
      .from(userGroupChannels)
      .innerJoin(channels, eq(channels.id, userGroupChannels.channelId))
      .where(eq(userGroupChannels.groupId, groupId))
      .orderBy(channels.name),
  ]);

  const group = toGroup(
    row,
    memberRows.length,
    channelRows.length,
    memberRows.some((m) => m.userId === viewerId),
  );

  return {
    ...group,
    members: memberRows.map((m) => ({
      userId: asUserId(m.userId),
      displayName: m.displayName,
      email: m.email,
      avatarUrl: m.avatarUrl ?? null,
      addedAt: m.addedAt.toISOString(),
    })),
    channels: channelRows.map((c) => ({
      channelId: asChannelId(c.channelId),
      name: c.name,
      isPrivate: c.type === "private",
    })),
  };
}

/**
 * Taking a channel into a group makes it private — otherwise "marketing only"
 * would not mean anything, since anyone could still browse and join it.
 */
async function claimChannel(workspaceId: string, channelId: ChannelId): Promise<void> {
  const [channel] = await db
    .select({ id: channels.id, type: channels.type, workspaceId: channels.workspaceId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  if (!channel || channel.workspaceId !== workspaceId) throw new NotFoundError("Channel");
  if (channel.type === "dm" || channel.type === "group_dm") {
    throw new BadRequestError("Direct messages cannot belong to a group");
  }
  if (channel.type !== "private") {
    await db.update(channels).set({ type: "private" }).where(eq(channels.id, channelId));
  }
}

export async function addGroupChannels(
  workspaceId: string,
  groupId: UserGroupId,
  channelIds: ChannelId[],
): Promise<void> {
  if (channelIds.length === 0) return;
  await requireGroup(workspaceId, groupId);

  for (const channelId of channelIds) {
    await claimChannel(workspaceId, channelId);
  }

  await db
    .insert(userGroupChannels)
    .values(channelIds.map((channelId) => ({ groupId, channelId })))
    .onConflictDoNothing();

  const memberIds = await groupMemberIds(groupId);
  for (const channelId of channelIds) {
    await addChannelMembersBulk(channelId, memberIds);
  }
}

async function groupMemberIds(groupId: UserGroupId): Promise<UserId[]> {
  const rows = await db
    .select({ userId: userGroupMembers.userId })
    .from(userGroupMembers)
    .where(eq(userGroupMembers.groupId, groupId));
  return rows.map((r) => asUserId(r.userId));
}

async function groupChannelIds(groupId: UserGroupId): Promise<ChannelId[]> {
  const rows = await db
    .select({ channelId: userGroupChannels.channelId })
    .from(userGroupChannels)
    .where(eq(userGroupChannels.groupId, groupId));
  return rows.map((r) => asChannelId(r.channelId));
}

export async function removeGroupChannel(
  workspaceId: string,
  groupId: UserGroupId,
  channelId: ChannelId,
): Promise<void> {
  await requireGroup(workspaceId, groupId);
  await db
    .delete(userGroupChannels)
    .where(
      and(eq(userGroupChannels.groupId, groupId), eq(userGroupChannels.channelId, channelId)),
    );

  // The channel stays private — it was made private deliberately, and silently
  // reopening it would be a surprising way to expose its history.
  const memberIds = await groupMemberIds(groupId);
  for (const userId of memberIds) {
    const stillGranted = await channelsHeldViaOtherGroups(userId, groupId);
    if (!stillGranted.has(channelId)) {
      await removeChannelMember(channelId, userId);
    }
  }
}

export async function addGroupMembers(
  workspaceId: string,
  groupId: UserGroupId,
  userIds: UserId[],
): Promise<void> {
  if (userIds.length === 0) return;
  await requireGroup(workspaceId, groupId);

  await db
    .insert(userGroupMembers)
    .values(userIds.map((userId) => ({ groupId, userId })))
    .onConflictDoNothing();

  const channelIds = await groupChannelIds(groupId);
  for (const channelId of channelIds) {
    await addChannelMembersBulk(channelId, userIds);
  }
}

export async function removeGroupMember(
  workspaceId: string,
  groupId: UserGroupId,
  userId: UserId,
): Promise<void> {
  await requireGroup(workspaceId, groupId);
  await db
    .delete(userGroupMembers)
    .where(and(eq(userGroupMembers.groupId, groupId), eq(userGroupMembers.userId, userId)));

  const stillGranted = await channelsHeldViaOtherGroups(userId, groupId);
  for (const channelId of await groupChannelIds(groupId)) {
    if (!stillGranted.has(channelId)) {
      await removeChannelMember(channelId, userId);
    }
  }
}

export async function createGroup(
  workspaceId: string,
  createdBy: UserId,
  input: {
    name: string;
    handle: string;
    purpose?: string | null;
    showAsSection?: boolean;
    channelIds?: ChannelId[];
    memberIds?: UserId[];
  },
): Promise<UserGroup> {
  const handle = input.handle.trim().toLowerCase();
  if (!isValidGroupHandle(handle)) {
    throw new BadRequestError(
      "Handle must be lowercase letters, numbers and dashes, 3-32 characters",
    );
  }

  const [existing] = await db
    .select({ id: userGroups.id })
    .from(userGroups)
    .where(and(eq(userGroups.workspaceId, workspaceId), eq(userGroups.handle, handle)))
    .limit(1);
  if (existing) throw new BadRequestError(`@${handle} is already taken`);

  const [row] = await db
    .insert(userGroups)
    .values({
      workspaceId,
      name: input.name.trim(),
      handle,
      purpose: input.purpose?.trim() || null,
      showAsSection: input.showAsSection ?? true,
      createdBy,
    })
    .returning();

  const groupId = asUserGroupId(row!.id);
  // Members first: the channels then pick them up in one pass.
  if (input.memberIds?.length) await addGroupMembers(workspaceId, groupId, input.memberIds);
  if (input.channelIds?.length) await addGroupChannels(workspaceId, groupId, input.channelIds);

  const [fresh] = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1);
  return toGroup(
    fresh!,
    input.memberIds?.length ?? 0,
    input.channelIds?.length ?? 0,
    (input.memberIds ?? []).includes(createdBy),
  );
}

export async function updateGroup(
  workspaceId: string,
  groupId: UserGroupId,
  input: { name?: string; handle?: string; purpose?: string | null; showAsSection?: boolean },
): Promise<void> {
  await requireGroup(workspaceId, groupId);

  const patch: Partial<typeof userGroups.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.purpose !== undefined) patch.purpose = input.purpose?.trim() || null;
  if (input.showAsSection !== undefined) patch.showAsSection = input.showAsSection;
  if (input.handle !== undefined) {
    const handle = input.handle.trim().toLowerCase();
    if (!isValidGroupHandle(handle)) {
      throw new BadRequestError(
        "Handle must be lowercase letters, numbers and dashes, 3-32 characters",
      );
    }
    const [clash] = await db
      .select({ id: userGroups.id })
      .from(userGroups)
      .where(and(eq(userGroups.workspaceId, workspaceId), eq(userGroups.handle, handle)))
      .limit(1);
    if (clash && clash.id !== groupId) throw new BadRequestError(`@${handle} is already taken`);
    patch.handle = handle;
  }

  await db.update(userGroups).set(patch).where(eq(userGroups.id, groupId));
}

/**
 * Deleting a group hands its channels back to their current members rather
 * than emptying them: the channels stay private with whoever is in them, so no
 * conversation disappears because an admin tidied up a group.
 */
export async function deleteGroup(workspaceId: string, groupId: UserGroupId): Promise<void> {
  await requireGroup(workspaceId, groupId);
  await db.delete(userGroups).where(eq(userGroups.id, groupId));
}

/** Groups the viewer belongs to that want their own sidebar heading. */
export async function sidebarSections(
  workspaceId: string,
  viewerId: UserId,
): Promise<SidebarGroupSection[]> {
  const rows = await db
    .select({
      groupId: userGroups.id,
      name: userGroups.name,
      channelId: userGroupChannels.channelId,
    })
    .from(userGroups)
    .innerJoin(userGroupMembers, eq(userGroupMembers.groupId, userGroups.id))
    .leftJoin(userGroupChannels, eq(userGroupChannels.groupId, userGroups.id))
    .where(
      and(
        eq(userGroups.workspaceId, workspaceId),
        eq(userGroupMembers.userId, viewerId),
        eq(userGroups.showAsSection, true),
      ),
    )
    .orderBy(userGroups.name);

  const sections = new Map<string, SidebarGroupSection>();
  for (const row of rows) {
    const section = sections.get(row.groupId) ?? {
      groupId: asUserGroupId(row.groupId),
      name: row.name,
      channelIds: [],
    };
    if (row.channelId) section.channelIds.push(asChannelId(row.channelId));
    sections.set(row.groupId, section);
  }
  return [...sections.values()];
}

/** Members of the groups named by `@handle`, for mention fan-out. */
export async function membersOfHandles(
  workspaceId: string,
  handles: string[],
): Promise<Map<string, UserId[]>> {
  if (handles.length === 0) return new Map();
  const rows = await db
    .select({ handle: userGroups.handle, userId: userGroupMembers.userId })
    .from(userGroups)
    .innerJoin(userGroupMembers, eq(userGroupMembers.groupId, userGroups.id))
    .where(
      and(
        eq(userGroups.workspaceId, workspaceId),
        inArray(userGroups.handle, handles.map((h) => h.toLowerCase())),
      ),
    );

  const map = new Map<string, UserId[]>();
  for (const row of rows) {
    const list = map.get(row.handle) ?? [];
    list.push(asUserId(row.userId));
    map.set(row.handle, list);
  }
  return map;
}

/** Groups in a workspace, for the composer's `@` autocomplete. */
export async function groupsForMention(
  workspaceId: string,
): Promise<{ id: UserGroupId; name: string; handle: string; memberCount: number }[]> {
  const rows = await db
    .select({
      id: userGroups.id,
      name: userGroups.name,
      handle: userGroups.handle,
      memberCount: sql<number>`count(${userGroupMembers.userId})::int`,
    })
    .from(userGroups)
    .leftJoin(userGroupMembers, eq(userGroupMembers.groupId, userGroups.id))
    .where(eq(userGroups.workspaceId, workspaceId))
    .groupBy(userGroups.id, userGroups.name, userGroups.handle)
    .orderBy(userGroups.name);

  return rows.map((r) => ({
    id: asUserGroupId(r.id),
    name: r.name,
    handle: r.handle,
    memberCount: r.memberCount,
  }));
}

/** Channel ids owned by any group, so the browser can hide them from outsiders. */
export async function groupOwnedChannelIds(workspaceId: string): Promise<Set<string>> {
  const rows = await db
    .select({ channelId: userGroupChannels.channelId })
    .from(userGroupChannels)
    .innerJoin(userGroups, eq(userGroups.id, userGroupChannels.groupId))
    .where(eq(userGroups.workspaceId, workspaceId));
  return new Set(rows.map((r) => r.channelId));
}
