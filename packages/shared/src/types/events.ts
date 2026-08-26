import type { MessageId, ChannelId, UserId, ScheduledMessageId, EmojiId, BookmarkId, ChannelTabId } from "./ids";
import type { ScheduledMessage } from "./scheduled-message";
import type { Channel } from "./channel";
import type { Message } from "./message";
import type { ReactionGroup } from "./reaction";
import type { HuddleState } from "./huddle";
import type { CustomEmoji } from "./custom-emoji";
import type { ChannelBookmark } from "./bookmark";
import type { ChannelTab } from "./tab";
import type { CanvasDatabase, CanvasDatabaseRow } from "./canvas-database";
import type { EphemeralMessage } from "./slash-command";

export interface SocketData {
  userId: UserId;
  isBot?: boolean;
}

// Client → Server events
export interface ClientToServerEvents {
  "channel:join": (payload: { channelId: ChannelId }) => void;
  "channel:leave": (payload: { channelId: ChannelId }) => void;
  "message:typing": (payload: { channelId: ChannelId }) => void;
  "presence:heartbeat": () => void;
}

// Server → Client events
export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:updated": (message: Message) => void;
  "message:deleted": (payload: {
    id: MessageId;
    channelId: ChannelId;
  }) => void;
  "user:typing": (payload: {
    userId: UserId;
    channelId: ChannelId;
  }) => void;
  "thread:updated": (payload: {
    parentMessageId: MessageId;
    channelId: ChannelId;
    replyCount: number;
    latestReplyAt: string;
  }) => void;
  "reaction:updated": (payload: {
    messageId: MessageId;
    channelId: ChannelId;
    reactions: ReactionGroup[];
  }) => void;
  "presence:updated": (payload: {
    userId: UserId;
    status: "online" | "offline";
    lastSeenAt: string | null;
  }) => void;
  "presence:sync": (payload: {
    users: Array<{
      userId: UserId;
      status: "online" | "offline";
      lastSeenAt: string | null;
      statusEmoji?: string | null;
      statusText?: string | null;
      statusExpiresAt?: string | null;
    }>;
  }) => void;
  "user:statusUpdated": (payload: {
    userId: UserId;
    statusEmoji: string | null;
    statusText: string | null;
    statusExpiresAt: string | null;
  }) => void;
  "huddle:started": (huddle: HuddleState) => void;
  "huddle:updated": (huddle: HuddleState) => void;
  "huddle:ended": (payload: { channelId: ChannelId }) => void;
  "huddle:sync": (payload: { huddles: HuddleState[] }) => void;
  "channel:created": (payload: { channel: Channel }) => void;
  "dm:created": (payload: { channel: Channel; otherUser: { id: UserId; displayName: string; avatarUrl: string | null } }) => void;
  "group-dm:created": (payload: { channel: Channel; members: { id: string; displayName: string; avatarUrl: string | null }[] }) => void;
  "channel:updated": (payload: { channelId: ChannelId; channel: Channel }) => void;
  "channel:member-added": (payload: { channelId: ChannelId; userId: UserId }) => void;
  "channel:member-removed": (payload: { channelId: ChannelId; userId: UserId }) => void;
  "message:pinned": (payload: { messageId: MessageId; channelId: ChannelId; pinnedBy: UserId; pinnedAt: string }) => void;
  "message:unpinned": (payload: { messageId: MessageId; channelId: ChannelId }) => void;
  "scheduledMessage:created": (payload: { id: ScheduledMessageId; channelId: ChannelId; scheduledFor: string; status: ScheduledMessage["status"] }) => void;
  "scheduledMessage:updated": (payload: { id: ScheduledMessageId; channelId: ChannelId; scheduledFor: string; status: ScheduledMessage["status"] }) => void;
  "scheduledMessage:deleted": (payload: { id: ScheduledMessageId; channelId: ChannelId }) => void;
  "scheduledMessage:sent": (payload: { id: ScheduledMessageId; channelId: ChannelId; messageId: MessageId }) => void;
  "scheduledMessage:failed": (payload: { id: ScheduledMessageId; channelId: ChannelId; failureReason: string }) => void;
  "emoji:added": (payload: { emoji: CustomEmoji }) => void;
  "emoji:deleted": (payload: { emojiId: EmojiId }) => void;
  "bookmark:added": (payload: { bookmark: ChannelBookmark }) => void;
  "bookmark:removed": (payload: { channelId: ChannelId; bookmarkId: BookmarkId }) => void;
  "tab:created": (payload: { tab: ChannelTab }) => void;
  "tab:updated": (payload: { tab: ChannelTab }) => void;
  "tab:removed": (payload: { channelId: ChannelId; tabId: ChannelTabId }) => void;
  "database:updated": (payload: { channelId: ChannelId; database: CanvasDatabase }) => void;
  "database:rowUpserted": (payload: { channelId: ChannelId; databaseId: string; row: CanvasDatabaseRow }) => void;
  "database:rowRemoved": (payload: { channelId: ChannelId; databaseId: string; rowId: string }) => void;
  "canvas:updated": (payload: {
    channelId: ChannelId;
    tabId: ChannelTabId;
    updatedBy: UserId;
    updatedAt: string;
  }) => void;
  "command:ephemeral": (payload: EphemeralMessage) => void;
  "user:profileUpdated": (payload: {
    userId: UserId;
    displayName: string;
    avatarUrl: string | null;
  }) => void;
}
