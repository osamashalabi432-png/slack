import type { ChannelId, UserGroupId, UserId } from "./ids";

/**
 * A user group is a team with a roster and a set of channels — Marketing,
 * Sales, Penetration Testing. It doubles as an access rule: a group's channels
 * are private, and belonging to the group is what puts you in them. Joining
 * the group joins you to every channel it owns; leaving takes them away.
 *
 * Only owners and admins can create or change groups, because changing one
 * changes who can read those channels.
 */
export interface UserGroup {
  id: UserGroupId;
  workspaceId: string;
  name: string;
  /** Lowercase, no spaces — what you type after `@` to mention the group. */
  handle: string;
  purpose: string | null;
  /** Show the group's channels under their own heading in the sidebar. */
  showAsSection: boolean;
  memberCount: number;
  channelCount: number;
  /** Whether the current user belongs to it. */
  isMember: boolean;
  createdBy: UserId | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserGroupMember {
  userId: UserId;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

export interface UserGroupChannel {
  channelId: ChannelId;
  name: string;
  /** Channels are made private when a group takes them over. */
  isPrivate: boolean;
}

export interface UserGroupDetail extends UserGroup {
  members: UserGroupMember[];
  channels: UserGroupChannel[];
}

/** A group's channels, grouped for the sidebar section rendering. */
export interface SidebarGroupSection {
  groupId: UserGroupId;
  name: string;
  channelIds: ChannelId[];
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Mirrors Slack's rule: lowercase, no spaces, usable after an `@`. */
export function isValidGroupHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

/** Best-effort handle from a display name, for the create form. */
export function handleFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
