import { useEffect, useMemo, useState } from "react";
import type { MentionSuggestionItem } from "@openslaq/editor";
import type { FolderContent, FolderItem } from "@openslaq/shared";
import { formatFileMentionId } from "@openslaq/shared";
import { fetchCanvasContent } from "@openslaq/client-core";
import { useChatStore } from "../../state/chat-store";
import { useOperationDeps } from "./useOperationDeps";
import { useGalleryMode } from "../../gallery/gallery-context";

function readItems(content: unknown): FolderItem[] {
  const items = (content as FolderContent | null)?.items;
  return Array.isArray(items) ? items : [];
}

/**
 * Every file and link in this channel's folder tabs, shaped for the @ menu.
 * Mentioning one drops a `<@file:tabId:itemId>` token that resolves to a
 * download on click — and only works for readers of this same channel.
 *
 * The tab strip (rendered by the channel view) is what loads `channelTabs`;
 * this hook just reads what's there and pulls each folder's contents.
 */
export function useChannelFolderFiles(
  workspaceSlug: string | undefined,
  channelId: string | undefined,
): MentionSuggestionItem[] {
  const deps = useOperationDeps();
  const isGallery = useGalleryMode();
  const { state } = useChatStore();

  const folderTabIds = useMemo(() => {
    const tabs = channelId ? (state.channelTabs[channelId] ?? []) : [];
    return tabs.filter((t) => t.type === "folder").map((t) => t.id);
  }, [state.channelTabs, channelId]);
  const key = folderTabIds.join(",");

  const [files, setFiles] = useState<MentionSuggestionItem[]>([]);

  useEffect(() => {
    if (isGallery || !workspaceSlug || !channelId || folderTabIds.length === 0) {
      setFiles((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    Promise.all(
      folderTabIds.map((tabId) =>
        fetchCanvasContent(deps, { workspaceSlug, channelId, tabId })
          .then((content) =>
            readItems(content).map(
              (item): MentionSuggestionItem => ({
                id: formatFileMentionId(tabId, item.id),
                displayName: item.name,
                isFile: true,
                fileKind: item.kind,
              }),
            ),
          )
          .catch(() => []),
      ),
    ).then((lists) => {
      if (!cancelled) setFiles(lists.flat());
    });
    return () => {
      cancelled = true;
    };
    // `folderTabIds` is captured by the joined `key`; `deps` is a stable service
    // handle from useOperationDeps and intentionally not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, workspaceSlug, channelId, isGallery]);

  return files;
}
