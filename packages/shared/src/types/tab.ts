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

/** A tab plus its document body — returned when opening a single tab. */
export interface ChannelTabWithContent extends ChannelTab {
  content: CanvasContent | null;
}
