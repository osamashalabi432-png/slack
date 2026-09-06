import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MessageSquare, Plus, ChevronDown, PenSquare, Trash2, Pencil, Folder } from "lucide-react";
import type { ChannelTab, ChannelTabType } from "@openslaq/shared";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { useConfirm } from "../ui";

interface ChannelTabsProps {
  tabs: ChannelTab[];
  /** null means the built-in Messages tab. */
  activeTabId: string | null;
  onSelectTab: (tabId: string | null) => void;
  onCreateTab: (type: ChannelTabType) => void;
  onRenameTab: (tabId: string, name: string) => void;
  /** Commit a new left-to-right order for the custom tabs. */
  onReorderTabs: (orderedIds: string[]) => void;
  onDeleteTab: (tabId: string) => void;
  canManage: boolean;
}

const tabClass = (active: boolean) =>
  clsx(
    "relative flex items-center gap-1.5 px-2 py-1.5 text-[13px] border-none bg-transparent cursor-pointer transition-colors whitespace-nowrap",
    active
      ? "font-semibold text-primary after:absolute after:left-2 after:right-2 after:-bottom-px after:h-[2px] after:bg-primary after:rounded-full"
      : "font-medium text-muted hover:text-primary",
  );

export function ChannelTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onRenameTab,
  onReorderTabs,
  onDeleteTab,
  canManage,
}: ChannelTabsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const endDrag = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);

  const commitReorder = useCallback(
    (from: string, to: string) => {
      endDrag();
      if (from === to) return;
      const ids: string[] = tabs.map((t) => t.id);
      const fromIndex = ids.indexOf(from);
      const toIndex = ids.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return;
      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, from);
      onReorderTabs(ids);
    },
    [tabs, onReorderTabs, endDrag],
  );

  useEffect(() => {
    if (renamingId) inputRef.current?.select();
  }, [renamingId]);

  const startRename = useCallback((tab: ChannelTab) => {
    setRenamingId(tab.id);
    setDraft(tab.name);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const name = draft.trim();
    const original = tabs.find((t) => t.id === renamingId)?.name;
    if (name && name !== original) onRenameTab(renamingId, name);
    setRenamingId(null);
  }, [renamingId, draft, tabs, onRenameTab]);

  const handleDelete = useCallback(
    async (tab: ChannelTab) => {
      const ok = await confirm({
        title: `Delete "${tab.name}"?`,
        description: "This removes the tab and its contents for everyone in the channel.",
        confirmLabel: "Delete",
        variant: "danger",
      });
      if (ok) onDeleteTab(tab.id);
    },
    [confirm, onDeleteTab],
  );

  return (
    // Setting overflow on one axis makes the other compute to `auto`, which
    // is what put a stray vertical scrollbar in the tab strip.
    <div
      className="px-3 flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar"
      data-testid="channel-tabs"
    >
      <button
        type="button"
        data-testid="channel-tab-messages"
        onClick={() => onSelectTab(null)}
        className={tabClass(activeTabId === null)}
      >
        <MessageSquare className="w-[14px] h-[14px]" />
        Messages
      </button>


      {tabs.map((tab) => {
        const active = tab.id === activeTabId;

        if (renamingId === tab.id) {
          return (
            <input
              key={tab.id}
              ref={inputRef}
              value={draft}
              data-testid={`channel-tab-rename-input-${tab.id}`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              maxLength={80}
              className="my-1 w-[140px] px-1.5 py-1 text-[13px] rounded border border-border-input bg-surface text-primary outline-none"
            />
          );
        }

        return (
          <div
            key={tab.id}
            data-testid={`channel-tab-drag-${tab.id}`}
            draggable={canManage && renamingId !== tab.id}
            onDragStart={(e) => {
              setDragId(tab.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", tab.id);
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === tab.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverId(tab.id);
            }}
            onDragLeave={() => setOverId((id) => (id === tab.id ? null : id))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragId ?? e.dataTransfer.getData("text/plain");
              if (from) commitReorder(from, tab.id);
            }}
            onDragEnd={endDrag}
            className={clsx(
              "flex items-center rounded transition-opacity",
              dragId === tab.id && "opacity-40",
              overId === tab.id && dragId !== null && dragId !== tab.id && "bg-surface-hover",
              canManage && renamingId !== tab.id && "cursor-grab active:cursor-grabbing",
            )}
          >
            <button
              type="button"
              data-testid={`channel-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => canManage && startRename(tab)}
              className={tabClass(active)}
            >
              {tab.type === "folder" ? (
                <Folder className="w-[14px] h-[14px]" />
              ) : (
                <PenSquare className="w-[14px] h-[14px]" />
              )}
              {tab.name}
            </button>

            {active && canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${tab.name} tab options`}
                    data-testid={`channel-tab-menu-${tab.id}`}
                    className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem
                    data-testid={`channel-tab-rename-${tab.id}`}
                    onSelect={() => startRename(tab)}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid={`channel-tab-delete-${tab.id}`}
                    onSelect={() => void handleDelete(tab)}
                    className="flex items-center gap-2 text-[13px] text-danger-text"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Add a tab"
              data-testid="channel-tab-add"
              className="w-6 h-6 ml-0.5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-surface-hover border-none bg-transparent cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuItem
              data-testid="channel-tab-add-canvas"
              onSelect={() => onCreateTab("canvas")}
              className="flex items-center gap-2 text-[13px]"
            >
              <PenSquare className="w-4 h-4" />
              Canvas
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="channel-tab-add-folder"
              onSelect={() => onCreateTab("folder")}
              className="flex items-center gap-2 text-[13px]"
            >
              <Folder className="w-4 h-4" />
              Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {dialog}
    </div>
  );
}
