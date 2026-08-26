import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPages,
  fetchPage,
  createPageOp,
  updatePageOp,
  movePageOp,
  archivePageOp,
  favouritePageOp,
  buildPageTree,
  type PageNode,
} from "@openslaq/client-core";
import type { CanvasContent, Page, PageDetail } from "@openslaq/shared";
import { api } from "../../api";
import { useAuthProvider } from "../../lib/api-client";

export interface PageActions {
  pages: Page[];
  tree: PageNode[];
  favourites: Page[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  get: (pageId: string) => Promise<PageDetail>;
  create: (parentId?: string | null, title?: string) => Promise<Page>;
  update: (
    pageId: string,
    input: {
      title?: string;
      icon?: string | null;
      coverUrl?: string | null;
      content?: CanvasContent;
      restrictedToGroupId?: string | null;
    },
  ) => Promise<PageDetail>;
  move: (pageId: string, parentId: string | null, position?: number) => Promise<void>;
  archive: (pageId: string, archived: boolean) => Promise<void>;
  favourite: (pageId: string, favourite: boolean) => Promise<void>;
}

/**
 * One source of truth for the page tree, held at the app level so the sidebar
 * and the open page never disagree — the mistake that made new user groups
 * invisible until a reload.
 */
export function usePages(workspaceSlug: string): PageActions {
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceSlug) return;
    try {
      setError(null);
      setPages(await fetchPages(deps, { workspaceSlug }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pages");
    } finally {
      setLoading(false);
    }
  }, [deps, workspaceSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const get = useCallback(
    (pageId: string) => fetchPage(deps, { workspaceSlug, pageId }),
    [deps, workspaceSlug],
  );

  const create = useCallback(
    async (parentId?: string | null, title?: string) => {
      const page = await createPageOp(deps, { workspaceSlug, parentId, title });
      // Show it and hand it back straight away. Awaiting a full reload first
      // left the caller on the old page for a beat, long enough to type a
      // title into it by mistake; the reload only reconciles.
      setPages((prev) => [...prev, page]);
      void reload();
      return page;
    },
    [deps, workspaceSlug, reload],
  );

  const update = useCallback<PageActions["update"]>(
    async (pageId, input) => {
      const detail = await updatePageOp(deps, { workspaceSlug, pageId, ...input });
      // The title and icon show in the tree, so the list has to follow. The
      // body does not, and reloading on every keystroke would be wasteful.
      if (input.title !== undefined || input.icon !== undefined) await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  const move = useCallback(
    async (pageId: string, parentId: string | null, position?: number) => {
      await movePageOp(deps, { workspaceSlug, pageId, parentId, position });
      await reload();
    },
    [deps, workspaceSlug, reload],
  );

  const archive = useCallback(
    async (pageId: string, archived: boolean) => {
      await archivePageOp(deps, { workspaceSlug, pageId, archived });
      await reload();
    },
    [deps, workspaceSlug, reload],
  );

  const favourite = useCallback(
    async (pageId: string, value: boolean) => {
      await favouritePageOp(deps, { workspaceSlug, pageId, favourite: value });
      await reload();
    },
    [deps, workspaceSlug, reload],
  );

  const tree = useMemo(() => buildPageTree(pages), [pages]);
  const favourites = useMemo(() => pages.filter((p) => p.isFavourite), [pages]);

  return { pages, tree, favourites, loading, error, reload, get, create, update, move, archive, favourite };
}
