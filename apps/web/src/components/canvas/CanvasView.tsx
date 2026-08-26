import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChannelTab } from "@openslaq/shared";
import { ensureTabPageOp, createDatabaseOp } from "@openslaq/client-core";
import { PRESET_NAMES, type DatabasePreset } from "@openslaq/shared";
import { CanvasContextProvider } from "./canvas-context";
import { useOperationDeps } from "../../hooks/chat/useOperationDeps";
import { usePages } from "../../hooks/chat/usePages";
import { PageView } from "../pages/PageView";
import { LoadingState, ErrorState } from "../ui";

interface CanvasViewProps {
  tab: ChannelTab;
  workspaceSlug: string;
  channelId: string;
  editable: boolean;
}

/**
 * A channel's canvas tab is a page.
 *
 * The tab points at a page holding the body; the first time it is opened, the
 * page is created and whatever the old canvas held is carried across. From
 * there it behaves like any other page: `/page` nests a sub-page inline, and
 * opening one keeps you inside the tab with breadcrumbs back up.
 */
export function CanvasView({ tab, workspaceSlug, channelId, editable }: CanvasViewProps) {
  const deps = useOperationDeps();
  const actions = usePages(workspaceSlug);

  const [rootPageId, setRootPageId] = useState<string | null>(null);
  const [openPageId, setOpenPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRootPageId(null);
    setOpenPageId(null);
    setError(null);

    ensureTabPageOp(deps, { workspaceSlug, channelId, tabId: tab.id as string })
      .then((pageId) => {
        if (cancelled) return;
        setRootPageId(pageId);
        setOpenPageId(pageId);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this canvas");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deps, workspaceSlug, channelId, tab.id]);

  const canvasContext = useMemo(
    () => ({ workspaceSlug, channelId, tabId: tab.id as string, editable }),
    [workspaceSlug, channelId, tab.id, editable],
  );

  const createDatabase = useCallback(
    async (preset: DatabasePreset) => {
      const database = await createDatabaseOp(deps, {
        workspaceSlug,
        channelId,
        name: PRESET_NAMES[preset],
        tabId: tab.id as string,
        preset,
      });
      return database.id as string;
    },
    [deps, workspaceSlug, channelId, tab.id],
  );

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!openPageId || !rootPageId) {
    return <LoadingState label="Opening canvas…" />;
  }

  return (
    <CanvasContextProvider value={canvasContext}>
      <PageView
        pageId={openPageId}
        actions={actions}
        onOpenPage={setOpenPageId}
        onCreateDatabase={createDatabase}
        // Archiving a sub-page drops you back to the tab's own page rather
        // than leaving the tab showing something that is no longer there.
        onClosePage={() => setOpenPageId(rootPageId)}
      />
    </CanvasContextProvider>
  );
}
