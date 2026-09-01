import type { ChannelId, ChannelTabId, UserId } from "./ids";

/**
 * Kinds of tab a channel can carry alongside its message history.
 * `messages` is implicit (always present, never stored) — everything
 * else is a row in `channel_tabs`.
 */
export const CHANNEL_TAB_TYPES = ["canvas", "folder"] as const;

export type ChannelTabType = (typeof CHANNEL_TAB_TYPES)[number];

/**
 * A canvas document is stored as TipTap/ProseMirror JSON. It is kept
 * opaque here so the editor owns the shape.
 */
export type CanvasContent = Record<string, unknown>;

export interface ChannelTab {
  id: ChannelTabId;
  channelId: ChannelId;
  type: ChannelTabType;
  name: string;
  position: number;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
  updatedBy: UserId | null;
}

/** One entry in a folder tab: an uploaded file or a bookmarked link. */
export interface FolderItem {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string;
  mimeType?: string | null;
  size?: number | null;
  addedAt: string;
}

/** A folder entry the current user saved, resolved for the Later view. */
export interface SavedFolderItem {
  item: FolderItem;
  tabId: ChannelTabId;
  tabName: string;
  channelId: ChannelId;
  channelName: string;
  savedAt: string;
}

/** Body shape stored for a folder tab. */
export interface FolderContent {
  items: FolderItem[];
}

/**
 * A folder entry referenced from a chat message, resolved on demand. The
 * download URL is freshly signed each call because presigned URLs expire.
 */
export interface FolderRef {
  name: string;
  kind: "file" | "link";
  downloadUrl: string;
}

/**
 * Files live in a channel's folder tabs and can be @-mentioned in that same
 * channel's messages. The mention is stored as `<@file:<tabId>:<itemId>>`, so
 * it rides the existing `<@…>` token namespace next to `here` / `group:`.
 */
export const FILE_MENTION_PREFIX = "file:";

export function formatFileMentionId(tabId: string, itemId: string): string {
  return `${FILE_MENTION_PREFIX}${tabId}:${itemId}`;
}

export function parseFileMentionId(
  value: string,
): { tabId: string; itemId: string } | null {
  if (!value.startsWith(FILE_MENTION_PREFIX)) return null;
  const rest = value.slice(FILE_MENTION_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { tabId: rest.slice(0, sep), itemId: rest.slice(sep + 1) };
}

/** A tab plus its document body — returned when opening a single tab. */
export interface ChannelTabWithContent extends ChannelTab {
  content: CanvasContent | null;
}
