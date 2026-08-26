import { authorizedRequest } from "../api/api-client";
import type { CanvasContent, Page, PageDetail } from "@openslaq/shared";
import type { OperationDeps } from "./types";

type Deps = Pick<OperationDeps, "api" | "auth">;

export async function fetchPages(
  deps: Deps,
  params: { workspaceSlug: string },
): Promise<Page[]> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages.$get(
      { param: { slug: params.workspaceSlug } },
      { headers },
    ),
  );
  return (await res.json()) as Page[];
}

export async function fetchPage(
  deps: Deps,
  params: { workspaceSlug: string; pageId: string },
): Promise<PageDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages[":pageId"].$get(
      { param: { slug: params.workspaceSlug, pageId: params.pageId } },
      { headers },
    ),
  );
  return (await res.json()) as PageDetail;
}

export async function createPageOp(
  deps: Deps,
  params: { workspaceSlug: string; parentId?: string | null; title?: string },
): Promise<Page> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages.$post(
      {
        param: { slug: params.workspaceSlug },
        json: { parentId: params.parentId ?? null, title: params.title },
      },
      { headers },
    ),
  );
  return (await res.json()) as Page;
}

export async function updatePageOp(
  deps: Deps,
  params: {
    workspaceSlug: string;
    pageId: string;
    title?: string;
    icon?: string | null;
    coverUrl?: string | null;
    content?: CanvasContent;
    restrictedToGroupId?: string | null;
  },
): Promise<PageDetail> {
  const { workspaceSlug, pageId, ...body } = params;
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages[":pageId"].$patch(
      { param: { slug: workspaceSlug, pageId }, json: body },
      { headers },
    ),
  );
  return (await res.json()) as PageDetail;
}

export async function movePageOp(
  deps: Deps,
  params: { workspaceSlug: string; pageId: string; parentId: string | null; position?: number },
): Promise<void> {
  await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages[":pageId"].move.$post(
      {
        param: { slug: params.workspaceSlug, pageId: params.pageId },
        json: { parentId: params.parentId, position: params.position },
      },
      { headers },
    ),
  );
}

export async function archivePageOp(
  deps: Deps,
  params: { workspaceSlug: string; pageId: string; archived: boolean },
): Promise<void> {
  await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages[":pageId"].archive.$post(
      {
        param: { slug: params.workspaceSlug, pageId: params.pageId },
        json: { archived: params.archived },
      },
      { headers },
    ),
  );
}

export async function favouritePageOp(
  deps: Deps,
  params: { workspaceSlug: string; pageId: string; favourite: boolean },
): Promise<void> {
  await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].pages[":pageId"].favourite.$post(
      {
        param: { slug: params.workspaceSlug, pageId: params.pageId },
        json: { favourite: params.favourite },
      },
      { headers },
    ),
  );
}

/**
 * The page behind a channel canvas tab, created on first open. Canvas tabs
 * are pages now; this is how the tab finds its own.
 */
export async function ensureTabPageOp(
  deps: Deps,
  params: { workspaceSlug: string; channelId: string; tabId: string },
): Promise<string> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].page.$post(
      { param: { slug: params.workspaceSlug, id: params.channelId, tabId: params.tabId } },
      { headers },
    ),
  );
  const body = (await res.json()) as { pageId: string };
  return body.pageId;
}

/**
 * The flat list the API returns, nested for rendering. Sorting happens here so
 * every consumer shows siblings in the same order.
 */
export interface PageNode extends Page {
  children: PageNode[];
}

export function buildPageTree(pages: Page[]): PageNode[] {
  const nodes = new Map<string, PageNode>();
  for (const page of pages) nodes.set(page.id as string, { ...page, children: [] });

  const roots: PageNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId as string) : undefined;
    // A page whose parent is hidden from this viewer surfaces at the root
    // rather than disappearing with it.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (list: PageNode[]) => {
    list.sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    for (const child of list) sort(child.children);
  };
  sort(roots);
  return roots;
}
