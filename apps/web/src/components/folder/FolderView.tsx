import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Link2,
  Upload,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Trash2,
  FolderOpen,
  Loader2,
  MoreVertical,
  ExternalLink,
  Download,
  Info,
  Pencil,
  FolderInput,
  Bookmark,
  Check,
} from "lucide-react";
import type { Attachment, ChannelTab, FolderContent, FolderItem } from "@openslaq/shared";
import {
  fetchCanvasContent,
  fetchSavedItemIds,
  saveFolderItemOp,
  unsaveFolderItemOp,
} from "@openslaq/client-core";
import { useOperationDeps } from "../../hooks/chat/useOperationDeps";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { requireAccessToken } from "../../lib/auth";
import { env } from "../../env";
import { LoadingState, ErrorState, Button } from "../ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../ui";

interface FolderViewProps {
  tab: ChannelTab;
  workspaceSlug: string;
  channelId: string;
  channelName: string;
  editable: boolean;
  onSave: (tabId: string, content: Record<string, unknown>) => Promise<unknown>;
  /** Every folder tab in this channel, used for "Move to folder". */
  folderTabs: ChannelTab[];
}

function iconFor(item: FolderItem) {
  if (item.kind === "link") return <Link2 className="w-5 h-5" />;
  const type = item.mimeType ?? "";
  if (type.startsWith("image/")) return <ImageIcon className="w-5 h-5" />;
  if (type.includes("zip") || type.includes("compressed")) return <FileArchive className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function readItems(content: unknown): FolderItem[] {
  const items = (content as FolderContent | null)?.items;
  return Array.isArray(items) ? items : [];
}

export function FolderView({
  tab,
  workspaceSlug,
  channelId,
  channelName,
  editable,
  onSave,
  folderTabs,
}: FolderViewProps) {
  const deps = useOperationDeps();
  const user = useCurrentUser();

  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [detailsItem, setDetailsItem] = useState<FolderItem | null>(null);
  const [editItem, setEditItem] = useState<FolderItem | null>(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirrors `items` so mutations always build on the latest list rather than
  // whatever was captured when their callback was created.
  const itemsRef = useRef<FolderItem[]>([]);
  // Bumped on every local mutation; a load that started earlier is discarded.
  const mutationRef = useRef(0);
  // Nested dragenter/dragleave pairs fire constantly; count them instead.
  const dragDepth = useRef(0);

  const load = useCallback(async () => {
    const startedAt = mutationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const content = await fetchCanvasContent(deps, { workspaceSlug, channelId, tabId: tab.id });
      // Someone edited the folder while this request was in flight — their
      // version is newer than what the server just handed back.
      if (mutationRef.current !== startedAt) return;
      const loaded = readItems(content);
      itemsRef.current = loaded;
      setItems(loaded);
    } catch {
      setLoadError("Couldn't load this folder.");
    } finally {
      setLoading(false);
    }
  }, [deps, workspaceSlug, channelId, tab.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchSavedItemIds(deps, { workspaceSlug, channelId, tabId: tab.id })
      .then((ids) => {
        if (!cancelled) setSavedIds(ids);
      })
      .catch(() => {
        // A failed Later lookup should not block the folder.
      });
    return () => {
      cancelled = true;
    };
  }, [deps, workspaceSlug, channelId, tab.id]);

  const persist = useCallback(
    (next: FolderItem[]) => {
      mutationRef.current += 1;
      itemsRef.current = next;
      setItems(next);
      void onSave(tab.id, { items: next } satisfies FolderContent as unknown as Record<string, unknown>).catch(
        () => setUploadError("Couldn't save this folder."),
      );
    },
    [onSave, tab.id],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0 || !user) return;

      setUploading(true);
      setUploadError(null);
      try {
        const token = await requireAccessToken(user);
        const formData = new FormData();
        for (const file of list) formData.append("files", file);

        const res = await fetch(`${env.VITE_API_URL}/api/uploads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Upload failed");
        }

        const data = (await res.json()) as { attachments: Attachment[] };
        const added: FolderItem[] = data.attachments.map((attachment) => ({
          id: String(attachment.id),
          kind: "file",
          name: attachment.filename,
          url: attachment.downloadUrl,
          mimeType: attachment.mimeType,
          size: attachment.size,
          addedAt: new Date().toISOString(),
        }));
        persist([...itemsRef.current, ...added]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [user, persist],
  );

  const addLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) return;
    const item: FolderItem = {
      id: crypto.randomUUID(),
      kind: "link",
      name: linkName.trim() || url.replace(/^https?:\/\//, ""),
      url,
      addedAt: new Date().toISOString(),
    };
    persist([...itemsRef.current, item]);
    setLinkUrl("");
    setLinkName("");
    setLinkOpen(false);
  }, [linkUrl, linkName, persist]);

  const removeItem = useCallback(
    (id: string) => persist(itemsRef.current.filter((i) => i.id !== id)),
    [persist],
  );

  const toggleSaved = useCallback(
    (item: FolderItem) => {
      const isSaved = savedIds.includes(item.id);
      setSavedIds((prev) => (isSaved ? prev.filter((id) => id !== item.id) : [...prev, item.id]));

      const op = isSaved ? unsaveFolderItemOp : saveFolderItemOp;
      void op(deps, { workspaceSlug, channelId, tabId: tab.id, itemId: item.id }).catch(() => {
        // Put the flag back if the write did not land.
        setSavedIds((prev) => (isSaved ? [...prev, item.id] : prev.filter((id) => id !== item.id)));
      });
    },
    [savedIds, deps, workspaceSlug, channelId, tab.id],
  );

  const copyLink = useCallback((item: FolderItem) => {
    void navigator.clipboard?.writeText(item.url).catch(() => {
      setUploadError("Couldn't copy that link.");
    });
  }, []);

  const commitEdit = useCallback(() => {
    if (!editItem) return;
    const name = editName.trim();
    if (name && name !== editItem.name) {
      persist(itemsRef.current.map((i) => (i.id === editItem.id ? { ...i, name } : i)));
    }
    setEditItem(null);
  }, [editItem, editName, persist]);

  /** Moves an entry into another folder tab in the same channel. */
  const moveToFolder = useCallback(
    async (item: FolderItem, targetTabId: string) => {
      try {
        const targetContent = await fetchCanvasContent(deps, {
          workspaceSlug,
          channelId,
          tabId: targetTabId,
        });
        const targetItems = readItems(targetContent);
        await onSave(targetTabId, { items: [...targetItems, item] });
        persist(itemsRef.current.filter((i) => i.id !== item.id));

        // A Later mark points at the tab holding the entry, so it has to
        // follow the entry across the move or it would dangle.
        if (savedIds.includes(item.id)) {
          setSavedIds((prev) => prev.filter((id) => id !== item.id));
          await unsaveFolderItemOp(deps, {
            workspaceSlug,
            channelId,
            tabId: tab.id,
            itemId: item.id,
          }).catch(() => {});
          await saveFolderItemOp(deps, {
            workspaceSlug,
            channelId,
            tabId: targetTabId,
            itemId: item.id,
          }).catch(() => {});
        }
      } catch {
        setUploadError("Couldn't move that item.");
      }
    },
    [deps, workspaceSlug, channelId, onSave, persist, savedIds, tab.id],
  );

  if (loading) return <LoadingState label="Loading folder..." className="flex-1" />;
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        action={
          <Button size="sm" onClick={() => void load()}>
            Try again
          </Button>
        }
        className="flex-1"
      />
    );
  }

  const addMenu = editable && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="folder-add-button"
          aria-label="Add to folder"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-slaq-green text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[180px]">
        <DropdownMenuItem
          data-testid="folder-add-upload"
          onSelect={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 text-[13px]"
        >
          <Upload className="w-4 h-4" />
          Upload file
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="folder-add-link"
          onSelect={() => setLinkOpen(true)}
          className="flex items-center gap-2 text-[13px]"
        >
          <Link2 className="w-4 h-4" />
          Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      data-testid="folder-view"
      className="flex-1 min-h-0 flex flex-col relative"
      onDragEnter={(e) => {
        if (!editable || !e.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!editable || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!editable) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        data-testid="folder-file-input"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between px-4 py-2 border-b border-border-default">
        <span className="text-[15px] font-bold text-primary truncate">{tab.name}</span>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="flex items-center gap-1 text-[12px] text-muted" data-testid="folder-uploading">
              <Loader2 className="w-3 h-3 animate-spin" />
              Uploading…
            </span>
          )}
          {addMenu}
        </div>
      </div>

      {uploadError && (
        <div className="px-4 py-2 text-[13px] text-danger-text bg-danger-bg border-b border-danger-border">
          {uploadError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
            <FolderOpen className="w-14 h-14 text-faint" strokeWidth={1.25} />
            <span className="text-[15px] font-bold text-primary">
              Add files and links to reference later
            </span>
            <span className="text-[13px] text-muted max-w-[380px]">
              Everyone in {channelName} will have access to what you add here. Drag files anywhere on
              this tab to upload them.
            </span>
            {addMenu && <div className="mt-2">{addMenu}</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                data-testid={`folder-item-${item.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border-default bg-surface p-3 hover:border-border-strong transition-colors"
              >
                <span className="shrink-0 w-9 h-9 rounded-md bg-surface-tertiary text-secondary flex items-center justify-center">
                  {iconFor(item)}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="block text-[13px] font-medium text-primary truncate hover:underline">
                    {item.name}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {item.kind === "link" ? "Link" : formatSize(item.size)}
                  </span>
                </a>
                {savedIds.includes(item.id) && (
                  <Bookmark
                    className="w-3.5 h-3.5 shrink-0 text-slaq-blue"
                    fill="currentColor"
                    data-testid={`folder-saved-${item.id}`}
                  />
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Options for ${item.name}`}
                      data-testid={`folder-menu-${item.id}`}
                      className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 w-7 h-7 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer transition-opacity shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuItem
                      data-testid={`folder-save-${item.id}`}
                      onSelect={() => toggleSaved(item)}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      {savedIds.includes(item.id) ? (
                        <>
                          <Check className="w-4 h-4" />
                          Remove from later
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          Save for later
                        </>
                      )}
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        data-testid={`folder-open-${item.id}`}
                        className="gap-2 text-[13px]"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          data-testid={`folder-open-tab-${item.id}`}
                          onSelect={() => window.open(item.url, "_blank", "noopener")}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in new tab
                        </DropdownMenuItem>
                        {item.kind === "file" && (
                          <DropdownMenuItem
                            data-testid={`folder-download-${item.id}`}
                            onSelect={() => {
                              const link = document.createElement("a");
                              link.href = item.url;
                              link.download = item.name;
                              link.click();
                            }}
                            className="flex items-center gap-2 text-[13px]"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem
                      data-testid={`folder-details-${item.id}`}
                      onSelect={() => setDetailsItem(item)}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      <Info className="w-4 h-4" />
                      View file details
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      data-testid={`folder-copy-${item.id}`}
                      onSelect={() => copyLink(item)}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      <Link2 className="w-4 h-4" />
                      Copy link to file
                    </DropdownMenuItem>

                    {editable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          data-testid={`folder-edit-${item.id}`}
                          onSelect={() => {
                            setEditItem(item);
                            setEditName(item.name);
                          }}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit file details
                        </DropdownMenuItem>
                      </>
                    )}

                    {editable && folderTabs.some((t) => t.id !== tab.id) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger
                            data-testid={`folder-move-${item.id}`}
                            className="gap-2 text-[13px]"
                          >
                            <FolderInput className="w-4 h-4 mr-2" />
                            Move to folder
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {folderTabs
                              .filter((t) => t.id !== tab.id)
                              .map((target) => (
                                <DropdownMenuItem
                                  key={target.id}
                                  data-testid={`folder-move-to-${target.id}`}
                                  onSelect={() => void moveToFolder(item, target.id)}
                                  className="flex items-center gap-2 text-[13px]"
                                >
                                  <FolderOpen className="w-4 h-4" />
                                  {target.name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </>
                    )}

                    {editable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          data-testid={`folder-remove-${item.id}`}
                          onSelect={() => removeItem(item.id)}
                          className="flex items-center gap-2 text-[13px] text-danger-text"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove file
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {dragging && (
        <div
          data-testid="folder-drop-overlay"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/85 border-2 border-dashed border-slaq-blue rounded-lg pointer-events-none"
        >
          <Upload className="w-10 h-10 text-slaq-blue mb-2" />
          <span className="text-[15px] font-semibold text-primary">Drop to add to {tab.name}</span>
        </div>
      )}

      <Dialog open={detailsItem !== null} onOpenChange={(open) => !open && setDetailsItem(null)}>
        <DialogContent size="sm" className="p-4">
          <DialogTitle className="mb-3">File details</DialogTitle>
          {detailsItem && (
            <dl className="flex flex-col gap-2 text-[13px]" data-testid="folder-details-dialog">
              {[
                ["Name", detailsItem.name],
                ["Kind", detailsItem.kind === "link" ? "Link" : (detailsItem.mimeType ?? "File")],
                ["Size", detailsItem.kind === "link" ? "—" : (formatSize(detailsItem.size) || "—")],
                ["Added", new Date(detailsItem.addedAt).toLocaleString()],
                ["Folder", tab.name],
                ["Channel", channelName],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 flex-1 text-primary break-words">{value}</dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Link</dt>
                <dd className="min-w-0 flex-1">
                  <a
                    href={detailsItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slaq-blue hover:underline break-all"
                  >
                    {detailsItem.url}
                  </a>
                </dd>
              </div>
            </dl>
          )}
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={() => setDetailsItem(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editItem !== null} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent size="sm" className="p-4">
          <DialogTitle className="mb-3">Edit file details</DialogTitle>
          <label htmlFor="folder-edit-name" className="block text-[13px] font-medium text-secondary mb-1">
            Name
          </label>
          <input
            id="folder-edit-name"
            data-testid="folder-edit-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
            }}
            className="w-full rounded-md border border-border-input bg-surface px-2 py-1.5 text-[13px] text-primary outline-none focus:border-slaq-blue mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button size="sm" data-testid="folder-edit-save" onClick={commitEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent size="sm" className="p-4">
          <DialogTitle className="mb-3">Add link</DialogTitle>
          <label htmlFor="folder-link-url" className="block text-[13px] font-medium text-secondary mb-1">
            Link
          </label>
          <input
            id="folder-link-url"
            data-testid="folder-link-url"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLink();
            }}
            placeholder="https://docs.example.com"
            className="w-full rounded-md border border-border-input bg-surface px-2 py-1.5 text-[13px] text-primary outline-none focus:border-slaq-blue mb-3"
          />
          <label htmlFor="folder-link-name" className="block text-[13px] font-medium text-secondary mb-1">
            Name (optional)
          </label>
          <input
            id="folder-link-name"
            data-testid="folder-link-name"
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLink();
            }}
            className="w-full rounded-md border border-border-input bg-surface px-2 py-1.5 text-[13px] text-primary outline-none focus:border-slaq-blue mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" data-testid="folder-link-submit" onClick={addLink} disabled={!linkUrl.trim()}>
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
