import { useCallback } from "react";
import type { ChannelId, ChannelTab, ChannelTabId, UserId } from "@openslaq/shared";
import { useSocketEvent } from "../useSocketEvent";
import { useChatStore } from "../../state/chat-store";

/**
 * Keeps channel tabs in sync across clients. Canvas bodies are not pushed over
 * the socket — subscribers re-read the document when someone else saves it.
 */
export function useTabTracking(onRemoteCanvasSave?: (tabId: ChannelTabId, updatedBy: UserId) => void) {
  const { dispatch } = useChatStore();

  const onCreated = useCallback(
    (payload: { tab: ChannelTab }) => {
      dispatch({ type: "tabs/add", tab: payload.tab });
    },
    [dispatch],
  );

  const onUpdated = useCallback(
    (payload: { tab: ChannelTab }) => {
      dispatch({ type: "tabs/update", tab: payload.tab });
    },
    [dispatch],
  );

  const onRemoved = useCallback(
    (payload: { channelId: ChannelId; tabId: ChannelTabId }) => {
      dispatch({ type: "tabs/remove", channelId: payload.channelId, tabId: payload.tabId });
    },
    [dispatch],
  );

  const onCanvasUpdated = useCallback(
    (payload: { channelId: ChannelId; tabId: ChannelTabId; updatedBy: UserId; updatedAt: string }) => {
      onRemoteCanvasSave?.(payload.tabId, payload.updatedBy);
    },
    [onRemoteCanvasSave],
  );

  useSocketEvent("tab:created", onCreated);
  useSocketEvent("tab:updated", onUpdated);
  useSocketEvent("tab:removed", onRemoved);
  useSocketEvent("canvas:updated", onCanvasUpdated);
}
