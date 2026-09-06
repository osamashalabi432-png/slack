import { authorizedRequest } from "../api/api-client";
import type { CanvasContent, ChannelTab, ChannelTabType } from "@openslaq/shared";
import type { OperationDeps } from "./types";

export async function fetchTabs(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string },
): Promise<ChannelTab[]> {
  const { api, auth, dispatch } = deps;
  const { workspaceSlug, channelId } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs.$get(
      { param: { slug: workspaceSlug, id: channelId } },
      { headers },
    ),
  );
  const data = (await res.json()) as { tabs: ChannelTab[] };
  dispatch({ type: "tabs/set", channelId, tabs: data.tabs });
  return data.tabs;
}

export async function fetchCanvasContent(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; tabId: string },
): Promise<CanvasContent | null> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$get(
      { param: { slug: workspaceSlug, id: channelId, tabId } },
      { headers },
    ),
  );
  const data = (await res.json()) as { content: CanvasContent | null };
  return data.content ?? null;
}

export async function createTabOp(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; type: ChannelTabType; name: string },
): Promise<ChannelTab> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, type, name } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs.$post(
      { param: { slug: workspaceSlug, id: channelId }, json: { type, name } },
      { headers },
    ),
  );
  // The socket event adds it to the store for everyone, including us.
  return (await res.json()) as ChannelTab;
}

export async function renameTabOp(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; tabId: string; name: string },
): Promise<void> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId, name } = params;

  await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$patch(
      { param: { slug: workspaceSlug, id: channelId, tabId }, json: { name } },
      { headers },
    ),
  );
}

/**
 * Persist a new tab order. Applies optimistically, then reconciles with the
 * server's authoritative list; on failure it re-reads the real order.
 */
export async function reorderTabsOp(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; orderedIds: string[] },
): Promise<void> {
  const { api, auth, dispatch, getState } = deps;
  const { workspaceSlug, channelId, orderedIds } = params;

  const prev = getState().channelTabs[channelId] ?? [];
  const byId = new Map(prev.map((t) => [t.id as string, t]));
  const optimistic = orderedIds
    .map((id, index) => {
      const tab = byId.get(id);
      return tab ? { ...tab, position: index } : null;
    })
    .filter((t): t is ChannelTab => t !== null);

  if (optimistic.length === prev.length && optimistic.length > 0) {
    dispatch({ type: "tabs/set", channelId, tabs: optimistic });
  }

  try {
    const res = await authorizedRequest(auth, (headers) =>
      api.api.workspaces[":slug"].channels[":id"].tabs.reorder.$put(
        { param: { slug: workspaceSlug, id: channelId }, json: { orderedIds } },
        { headers },
      ),
    );
    if (!res.ok) throw new Error(`Failed to reorder tabs (${res.status})`);
    const data = (await res.json()) as { tabs: ChannelTab[] };
    dispatch({ type: "tabs/set", channelId, tabs: data.tabs });
  } catch (error) {
    await fetchTabs(deps, { workspaceSlug, channelId }).catch(() => {});
    throw error;
  }
}

export async function saveCanvasOp(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; tabId: string; content: CanvasContent },
): Promise<string> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId, content } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].content.$put(
      { param: { slug: workspaceSlug, id: channelId, tabId }, json: { content } },
      { headers },
    ),
  );
  const data = (await res.json()) as { updatedAt: string };
  return data.updatedAt;
}

export async function deleteTabOp(
  deps: OperationDeps,
  params: { workspaceSlug: string; channelId: string; tabId: string },
): Promise<void> {
  const { api, auth, dispatch } = deps;
  const { workspaceSlug, channelId, tabId } = params;

  // Optimistic removal; the socket event confirms for everyone else.
  dispatch({ type: "tabs/remove", channelId, tabId });

  try {
    await authorizedRequest(auth, (headers) =>
      api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$delete(
        { param: { slug: workspaceSlug, id: channelId, tabId } },
        { headers },
      ),
    );
  } catch (error) {
    // Rollback by re-reading the authoritative list.
    await fetchTabs(deps, { workspaceSlug, channelId }).catch(() => {});
    throw error;
  }
}
