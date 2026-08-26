import { useCallback, useEffect, useState } from "react";
import type { SavedFolderItem } from "@openslaq/shared";
import { fetchSavedFolderItems, unsaveFolderItemOp } from "@openslaq/client-core";
import { useOperationDeps } from "./useOperationDeps";
import { useGalleryMode } from "../../gallery/gallery-context";

/** Folder entries the current user saved for later, for the Later view. */
export function useSavedFolderItems(workspaceSlug: string | undefined) {
  const deps = useOperationDeps();
  const isGallery = useGalleryMode();
  const [items, setItems] = useState<SavedFolderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (isGallery || !workspaceSlug) return;
    setLoading(true);
    try {
      setItems(await fetchSavedFolderItems(deps, { workspaceSlug }));
    } catch {
      // Saved files are supplementary; a failure should not break the view.
    } finally {
      setLoading(false);
    }
  }, [deps, workspaceSlug, isGallery]);

  useEffect(() => {
    void load();
  }, [load]);

  const unsave = useCallback(
    (entry: SavedFolderItem) => {
      setItems((prev) => prev.filter((i) => i.item.id !== entry.item.id || i.tabId !== entry.tabId));
      if (!workspaceSlug) return;
      void unsaveFolderItemOp(deps, {
        workspaceSlug,
        channelId: entry.channelId,
        tabId: entry.tabId,
        itemId: entry.item.id,
      }).catch(() => {
        void load();
      });
    },
    [deps, workspaceSlug, load],
  );

  return { items, loading, unsave, reload: load };
}
