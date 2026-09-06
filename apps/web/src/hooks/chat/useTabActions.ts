import { useCallback, useEffect } from "react";
import type { CanvasContent, ChannelTabType } from "@openslaq/shared";
import { fetchTabs, createTabOp, renameTabOp, reorderTabsOp, deleteTabOp, saveCanvasOp } from "@openslaq/client-core";
import { useChatStore } from "../../state/chat-store";
import { useOperationDeps } from "./useOperationDeps";
import { useGalleryMode } from "../../gallery/gallery-context";

/**
 * Loads the tab strip for the active channel and exposes tab mutations.
 */
export function useTabActions(workspaceSlug: string | undefined, channelId: string | undefined) {
  const deps = useOperationDeps();
  const { state, dispatch } = useChatStore();
  const isGallery = useGalleryMode();

  // Load the strip whenever the channel changes.
  useEffect(() => {
    if (isGallery || !workspaceSlug || !channelId) return;
    if (state.channelTabs[channelId]) return;
    void fetchTabs(deps, { workspaceSlug, channelId }).catch(() => {
      // A failed strip load should not block the message view.
    });
  }, [deps, workspaceSlug, channelId, isGallery, state.channelTabs]);

  const tabs = channelId ? (state.channelTabs[channelId] ?? []) : [];

  const selectTab = useCallback(
    (tabId: string | null) => {
      dispatch({ type: "tabs/select", tabId });
    },
    [dispatch],
  );

  const createTab = useCallback(
    async (type: ChannelTabType, name: string) => {
      if (!workspaceSlug || !channelId) return;
      const tab = await createTabOp(deps, { workspaceSlug, channelId, type, name });
      dispatch({ type: "tabs/add", tab });
      dispatch({ type: "tabs/select", tabId: tab.id });
      return tab;
    },
    [deps, workspaceSlug, channelId, dispatch],
  );

  const renameTab = useCallback(
    async (tabId: string, name: string) => {
      if (!workspaceSlug || !channelId) return;
      await renameTabOp(deps, { workspaceSlug, channelId, tabId, name });
    },
    [deps, workspaceSlug, channelId],
  );

  const deleteTab = useCallback(
    async (tabId: string) => {
      if (!workspaceSlug || !channelId) return;
      await deleteTabOp(deps, { workspaceSlug, channelId, tabId });
    },
    [deps, workspaceSlug, channelId],
  );

  const reorderTabs = useCallback(
    async (orderedIds: string[]) => {
      if (!workspaceSlug || !channelId) return;
      await reorderTabsOp(deps, { workspaceSlug, channelId, orderedIds });
    },
    [deps, workspaceSlug, channelId],
  );

  const saveCanvas = useCallback(
    async (tabId: string, content: CanvasContent) => {
      if (!workspaceSlug || !channelId) return null;
      return saveCanvasOp(deps, { workspaceSlug, channelId, tabId, content });
    },
    [deps, workspaceSlug, channelId],
  );

  return { tabs, activeTabId: state.activeTabId, selectTab, createTab, renameTab, reorderTabs, deleteTab, saveCanvas };
}
