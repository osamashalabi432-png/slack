import { authorizedRequest } from "../api/api-client";
import type {
  CanvasDatabase,
  CanvasDatabaseRow,
  CanvasDatabaseWithRows,
  DatabasePreset,
  DbProperty,
  DbRowValues,
  DbView,
} from "@openslaq/shared";
import type { OperationDeps } from "./types";

type Deps = Pick<OperationDeps, "api" | "auth">;

export async function createDatabaseOp(
  deps: Deps,
  params: {
    workspaceSlug: string;
    channelId: string;
    name: string;
    tabId?: string | null;
    preset?: DatabasePreset;
  },
): Promise<CanvasDatabase> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, name, tabId, preset } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases.$post(
      {
        param: { slug: workspaceSlug, id: channelId },
        json: { name, tabId: tabId ?? null, preset: preset ?? "full" },
      },
      { headers },
    ),
  );
  return (await res.json()) as CanvasDatabase;
}

export async function fetchDatabase(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; databaseId: string },
): Promise<CanvasDatabaseWithRows> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, databaseId } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get(
      { param: { slug: workspaceSlug, id: channelId, databaseId } },
      { headers },
    ),
  );
  return (await res.json()) as CanvasDatabaseWithRows;
}

export async function updateDatabaseOp(
  deps: Deps,
  params: {
    workspaceSlug: string;
    channelId: string;
    databaseId: string;
    patch: { name?: string; properties?: DbProperty[]; views?: DbView[] };
  },
): Promise<CanvasDatabase> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, databaseId, patch } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$patch(
      { param: { slug: workspaceSlug, id: channelId, databaseId }, json: patch },
      { headers },
    ),
  );
  return (await res.json()) as CanvasDatabase;
}

export async function createDatabaseRowOp(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; databaseId: string; values: DbRowValues },
): Promise<CanvasDatabaseRow> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, databaseId, values } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post(
      { param: { slug: workspaceSlug, id: channelId, databaseId }, json: { values } },
      { headers },
    ),
  );
  return (await res.json()) as CanvasDatabaseRow;
}

export async function updateDatabaseRowOp(
  deps: Deps,
  params: {
    workspaceSlug: string;
    channelId: string;
    databaseId: string;
    rowId: string;
    patch: { values?: DbRowValues; position?: number };
  },
): Promise<CanvasDatabaseRow> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, databaseId, rowId, patch } = params;

  const res = await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows[":rowId"].$patch(
      { param: { slug: workspaceSlug, id: channelId, databaseId, rowId }, json: patch },
      { headers },
    ),
  );
  return (await res.json()) as CanvasDatabaseRow;
}

export async function deleteDatabaseRowOp(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; databaseId: string; rowId: string },
): Promise<void> {
  const { api, auth } = deps;
  const { workspaceSlug, channelId, databaseId, rowId } = params;

  await authorizedRequest(auth, (headers) =>
    api.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows[":rowId"].$delete(
      { param: { slug: workspaceSlug, id: channelId, databaseId, rowId } },
      { headers },
    ),
  );
}
