import { useCallback, useMemo } from "react";
import { Bookmark, FileText, Link2 } from "lucide-react";
import { MessageItem } from "../message/MessageItem";
import { MessageActionsProvider } from "../message/MessageActionsContext";
import { EmptyState, LoadingState, ErrorState } from "../ui";
import { useSavedMessages } from "../../hooks/chat/useSavedMessages";
import { useSavedFolderItems } from "../../hooks/chat/useSavedFolderItems";
import type { SavedFolderItem } from "@openslaq/shared";
import type { SavedMessageItem } from "@openslaq/client-core";

interface SavedItemsViewProps {
  workspaceSlug: string;
  currentUserId: string;
  onNavigateToChannel: (channelId: string, messageId?: string) => void;
  onOpenThread: (messageId: string) => void;
  onOpenProfile: (userId: string) => void;
  onUnsaveMessage: (messageId: string, channelId: string) => void;
}

export function SavedItemsView({
  workspaceSlug,
  currentUserId,
  onNavigateToChannel,
  onOpenThread,
  onOpenProfile,
  onUnsaveMessage,
}: SavedItemsViewProps) {
  const { data, loading, error, removeItem } = useSavedMessages(workspaceSlug);
  const savedFiles = useSavedFolderItems(workspaceSlug);

  const handleMessageClick = useCallback(
    (channelId: string, messageId: string) => {
      onNavigateToChannel(channelId, messageId);
    },
    [onNavigateToChannel],
  );

  const handleUnsave = useCallback(
    (item: SavedMessageItem) => {
      onUnsaveMessage(item.message.id, item.message.channelId);
      removeItem(item.message.id);
    },
    [onUnsaveMessage, removeItem],
  );

  const actionsContextValue = useMemo(
    () => ({
      currentUserId,
      onOpenThread,
      onOpenProfile,
    }),
    [currentUserId, onOpenThread, onOpenProfile],
  );

  return (
    <MessageActionsProvider value={actionsContextValue}>
      <div className="flex flex-col h-full" data-testid="saved-items-view">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
          <h2 className="text-lg font-bold text-primary">Saved Items</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && !data && (
            <LoadingState label="Loading saved messages..." />
          )}

          {error && (
            <ErrorState message={error} />
          )}

          {data && data.length === 0 && savedFiles.items.length === 0 && (
            <EmptyState
              icon={<Bookmark className="w-full h-full" strokeWidth={1.5} />}
              title="Nothing saved yet"
              subtitle="Save messages and files for quick reference later"
              data-testid="saved-empty-state"
            />
          )}

          {savedFiles.items.length > 0 && (
            <div data-testid="saved-files-section">
              <div className="px-4 py-2 border-b border-border-default bg-surface-raised">
                <span className="text-[13px] font-semibold text-secondary">Files</span>
              </div>
              {savedFiles.items.map((entry) => (
                <SavedFileRow
                  key={`${entry.tabId}:${entry.item.id}`}
                  entry={entry}
                  onUnsave={() => savedFiles.unsave(entry)}
                />
              ))}
            </div>
          )}

          {data?.map((item) => (
            <SavedMessageGroup
              key={item.message.id}
              item={item}
              onMessageClick={(messageId) => handleMessageClick(item.message.channelId, messageId)}
              onUnsave={() => handleUnsave(item)}
            />
          ))}
        </div>
      </div>
    </MessageActionsProvider>
  );
}

function SavedMessageGroup({
  item,
  onMessageClick,
  onUnsave,
}: {
  item: SavedMessageItem;
  onMessageClick: (messageId: string) => void;
  onUnsave: () => void;
}) {
  return (
    <div data-testid={`saved-message-${item.message.id}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-default bg-surface-raised">
        <span className="text-[13px] font-semibold text-secondary">
          # {item.channelName}
        </span>
        <button
          type="button"
          onClick={onUnsave}
          className="text-[12px] text-link hover:underline bg-transparent border-none cursor-pointer"
          data-testid={`unsave-${item.message.id}`}
        >
          Remove
        </button>
      </div>
      <div className="px-4 py-2">
        <div
          className="cursor-pointer"
          onClick={() => onMessageClick(item.message.id)}
        >
          <MessageItem message={item.message} />
        </div>
      </div>
    </div>
  );
}

function SavedFileRow({
  entry,
  onUnsave,
}: {
  entry: SavedFolderItem;
  onUnsave: () => void;
}) {
  const { item } = entry;
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-border-secondary"
      data-testid={`saved-file-${item.id}`}
    >
      <span className="shrink-0 w-8 h-8 rounded-md bg-surface-tertiary text-secondary flex items-center justify-center">
        {item.kind === "link" ? <Link2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
      </span>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1"
      >
        <span className="block text-[13px] font-medium text-primary truncate hover:underline">
          {item.name}
        </span>
        <span className="block text-[11px] text-muted truncate">
          #{entry.channelName} / {entry.tabName}
        </span>
      </a>
      <button
        type="button"
        onClick={onUnsave}
        className="text-[12px] text-link hover:underline bg-transparent border-none cursor-pointer shrink-0"
        data-testid={`unsave-file-${item.id}`}
      >
        Remove
      </button>
    </div>
  );
}
