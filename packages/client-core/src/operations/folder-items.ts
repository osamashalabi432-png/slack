import { authorizedRequest } from "../api/api-client";
import type { SavedFolderItem } from "@openslaq/shared";
import type { OperationDeps } from "./types";

type Deps = Pick<OperationDeps, "api" | "auth">;

/** Ids the caller has saved within one folder tab. */
export async function fetchSavedItemIds(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; tabId: string },
): Promise<string[]> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"]["saved-items"].$get(
      { param: { slug: workspaceSlug, id: channelId, tabId } },
      { headers },
    ),
  );
  const data = (await res.json()) as { itemIds: string[] };
  return data.itemIds;
}

export async function saveFolderItemOp(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; tabId: string; itemId: string },
): Promise<void> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId, itemId } = params;

  await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].items[":itemId"].save.$put(
      { param: { slug: workspaceSlug, id: channelId, tabId, itemId } },
      { headers },
    ),
  );
}

export async function unsaveFolderItemOp(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; tabId: string; itemId: string },
): Promise<void> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, tabId, itemId } = params;

  await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].items[":itemId"].save.$delete(
      { param: { slug: workspaceSlug, id: channelId, tabId, itemId } },
      { headers },
    ),
  );
}

/** Everything the caller saved for later across the workspace. */
export async function fetchSavedFolderItems(
  deps: Deps,
  params: { workspaceSlug: string },
): Promise<SavedFolderItem[]> {
  const { api, auth } = deps;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"]["saved-files"].$get(
      { param: { slug: params.workspaceSlug } },
      { headers },
    ),
  );
  const data = (await res.json()) as { items: SavedFolderItem[] };
  return data.items;
}
