import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { ChannelList } from "../channel/ChannelList";
import { StarredList } from "../channel/StarredList";
import { CreateChannelDialog } from "../channel/CreateChannelDialog";
import { GroupSections } from "./GroupSections";
import { BrowseChannelsDialog } from "../channel/BrowseChannelsDialog";
import { DmList } from "../dm/DmList";
import {
  ChevronDown,
  LayoutGrid,
  UserPlus,
  Settings,
  Search,
  Headphones,
  BookUser,
  SquarePen,
  X,
} from "lucide-react";
import { Tooltip } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import type { Channel, HuddleState, ChannelNotifyLevel, SidebarGroupSection } from "@openslaq/shared";
import type { WorkspaceInfo, DmConversation, GroupDmConversation, PresenceEntry } from "../../state/chat-store";

interface SidebarProps {
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  channels: Channel[];
  activeDmId: string | null;
  onSelectDm: (channelId: string) => void;
  dms: DmConversation[];
  groupDms: GroupDmConversation[];
  activeGroupDmId: string | null;
  onSelectGroupDm: (channelId: string) => void;
  currentUserId: string;
  workspaceSlug: string;
  workspaces: WorkspaceInfo[];
  unreadCounts: Record<string, number>;
  onSelectDirectoryView: () => void;
  /** Groups with their own sidebar heading, from the groups the user is in. */
  groupSections?: SidebarGroupSection[];
  presence: Record<string, PresenceEntry>;
  onChannelCreated?: (channel: Channel) => void;
  activeHuddles?: Record<string, HuddleState>;
  starredChannelIds?: string[];
  channelNotificationPrefs?: Record<string, ChannelNotifyLevel>;
  onSetNotificationLevel?: (channelId: string, level: ChannelNotifyLevel) => void;
  activeView?:
    | "channel"
    | "unreads"
    | "saved"
    | "outbox"
    | "files"
    | "compose"
    | "directory"
    | "page";
  onSelectComposeView?: () => void;
  onOpenInvite?: () => void;
  onOpenWorkspaceSettings?: () => void;
  onJoinHuddle?: (channelId: string, channelName?: string) => void;
  style?: React.CSSProperties;
}

function loadCollapseState(): { channels: boolean; dms: boolean } {
  try {
    const stored = localStorage.getItem("openslaq-sidebar-collapse");
    if (stored) return JSON.parse(stored) as { channels: boolean; dms: boolean };
  } catch {
    // ignore
  }
  return { channels: false, dms: false };
}

export function Sidebar({
  activeChannelId,
  onSelectChannel,
  channels,
  activeDmId,
  onSelectDm,
  dms,
  groupDms,
  activeGroupDmId,
  onSelectGroupDm,
  currentUserId,
  workspaceSlug,
  workspaces,
  unreadCounts,
  onSelectDirectoryView,
  groupSections = [],
  presence,
  onChannelCreated,
  activeHuddles,
  starredChannelIds,
  channelNotificationPrefs,
  onSelectComposeView,
  onSetNotificationLevel,
  onOpenInvite,
  onOpenWorkspaceSettings,
  onJoinHuddle,
  style,
}: SidebarProps) {
  const navigate = useNavigate();
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [browseChannelsOpen, setBrowseChannelsOpen] = useState(false);
  const [sidebarCollapse, setSidebarCollapse] = useState(loadCollapseState);
  const [filter, setFilter] = useState("");

  const toggleChannelsCollapsed = useCallback(() => {
    setSidebarCollapse((prev) => {
      const next = { ...prev, channels: !prev.channels };
      localStorage.setItem("openslaq-sidebar-collapse", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleDmsCollapsed = useCallback(() => {
    setSidebarCollapse((prev) => {
      const next = { ...prev, dms: !prev.dms };
      localStorage.setItem("openslaq-sidebar-collapse", JSON.stringify(next));
      return next;
    });
  }, []);

  const currentWorkspace = workspaces.find((ws) => ws.slug === workspaceSlug);
  const workspaceName = currentWorkspace?.name ?? workspaceSlug;
  const canManage = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  const query = filter.trim().toLowerCase();
  const matches = useCallback((name: string) => !query || name.toLowerCase().includes(query), [query]);

  const huddleEntries = useMemo(() => {
    const entries = Object.entries(activeHuddles ?? {});
    return entries.map(([channelId, huddle]) => {
      const channel = channels.find((ch) => ch.id === channelId);
      const dm = dms.find((d) => d.channel.id === channelId);
      return {
        channelId,
        name: channel ? `#${channel.name}` : (dm?.otherUser.displayName ?? "Huddle"),
        participantCount: huddle.participants.length,
      };
    });
  }, [activeHuddles, channels, dms]);

  const sectionedChannelIds = new Set(
    groupSections.flatMap((section) => section.channelIds as unknown as string[]),
  );
  const visibleChannels = channels
    .filter(
      (ch) =>
        !ch.isArchived &&
        !starredChannelIds?.includes(ch.id) &&
        !sectionedChannelIds.has(ch.id) &&
        matches(ch.name),
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "public" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const visibleDms = dms.filter(
    (dm) => !starredChannelIds?.includes(dm.channel.id) && matches(dm.otherUser.displayName),
  );
  const visibleGroupDms = groupDms.filter(
    (g) =>
      !starredChannelIds?.includes(g.channel.id) &&
      matches(g.channel.displayName ?? g.members.map((m) => m.displayName).join(", ")),
  );

  return (
    <div
      data-testid="sidebar"
      className="shrink-0 bg-sidebar text-sidebar-text flex flex-col min-h-0 mb-2 rounded-lg overflow-hidden"
      style={style}
    >
      {/* Workspace header */}
      <div className="flex items-center gap-1 pl-4 pr-2 h-[50px] shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="workspace-menu-button"
              className="flex-1 min-w-0 font-black text-[18px] text-sidebar-text bg-transparent border-none cursor-pointer flex items-center text-left focus:outline-none hover:opacity-80 transition-opacity"
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{workspaceName}</span>
              <ChevronDown size={16} className="ml-1 shrink-0" strokeWidth={3} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={0}
            className="min-w-[220px] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto"
          >
            {workspaces
              .filter((ws) => ws.slug !== workspaceSlug)
              .map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onSelect={() => navigate(`/w/${ws.slug}`)}
                  className="flex items-center gap-2"
                >
                  <span className="w-5 h-5 rounded bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                  {ws.name}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/")} className="text-text-secondary text-[13px] flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              All workspaces
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenInvite?.()} className="text-text-secondary text-[13px] flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite People
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenWorkspaceSettings?.()} className="text-text-secondary text-[13px] flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Workspace settings" side="bottom">
          <button
            type="button"
            onClick={() => onOpenWorkspaceSettings?.()}
            aria-label="Workspace settings"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors border-none bg-transparent cursor-pointer"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <Tooltip content="New message" side="bottom">
          <button
            type="button"
            onClick={() => onSelectComposeView?.()}
            aria-label="New message"
            data-testid="sidebar-compose-button"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors border-none bg-transparent cursor-pointer"
          >
            <SquarePen className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
      </div>

      {/* Conversation filter */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2 w-[14px] h-[14px] text-sidebar-muted pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a conversation..."
            data-testid="sidebar-filter-input"
            aria-label="Find a conversation"
            className="w-full h-[30px] rounded-md bg-white/10 border border-sidebar-border pl-7 pr-7 text-[13px] text-sidebar-text placeholder:text-sidebar-muted outline-none focus:border-white/40 transition-colors"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear filter"
              className="absolute right-1.5 w-5 h-5 flex items-center justify-center rounded text-sidebar-muted hover:text-sidebar-text border-none bg-transparent cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="px-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="huddles-nav-button"
              className="w-full flex items-center gap-2.5 px-2 py-[5px] rounded-md text-[15px] text-sidebar-text/90 hover:bg-sidebar-hover border-none bg-transparent cursor-pointer text-left transition-colors"
            >
              <Headphones className="w-[18px] h-[18px] shrink-0 text-sidebar-muted" />
              Huddles
              {huddleEntries.length > 0 && (
                <span className="ml-auto text-[11px] font-bold bg-sidebar-accent text-black rounded-full px-1.5 py-0.5 leading-none">
                  {huddleEntries.length}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[240px]">
            {huddleEntries.length === 0 ? (
              <div className="px-2 py-3 text-[13px] text-text-muted text-center">No active huddles</div>
            ) : (
              huddleEntries.map((entry) => (
                <DropdownMenuItem
                  key={entry.channelId}
                  onSelect={() => onJoinHuddle?.(entry.channelId, entry.name)}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <Headphones className="w-4 h-4 text-green-500" />
                  <span className="truncate">{entry.name}</span>
                  <span className="ml-auto text-text-muted">{entry.participantCount}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={onSelectDirectoryView}
          data-testid="directories-nav-button"
          className="w-full flex items-center gap-2.5 px-2 py-[5px] rounded-md text-[15px] text-sidebar-text/90 hover:bg-sidebar-hover border-none bg-transparent cursor-pointer text-left transition-colors"
        >
          <BookUser className="w-[18px] h-[18px] shrink-0 text-sidebar-muted" />
          Directories
        </button>
      </div>

      <div className="mx-3 my-2 border-t border-sidebar-border shrink-0" />

      {/* Conversation lists */}
      <div className="flex-1 overflow-y-auto chrome-scroll min-h-0">
        {starredChannelIds && starredChannelIds.length > 0 && (() => {
          const starredSet = new Set(starredChannelIds);
          const starredChannels = channels.filter(
            (ch) => starredSet.has(ch.id) && !ch.isArchived && matches(ch.name),
          );
          const starredDmsItems = dms.filter(
            (dm) => starredSet.has(dm.channel.id) && matches(dm.otherUser.displayName),
          );
          if (starredChannels.length === 0 && starredDmsItems.length === 0) return null;
          return (
            <StarredList
              starredChannels={starredChannels}
              starredDms={starredDmsItems}
              activeChannelId={activeChannelId}
              activeDmId={activeDmId}
              onSelectChannel={onSelectChannel}
              onSelectDm={onSelectDm}
              unreadCounts={unreadCounts}
              presence={presence}
              activeHuddles={activeHuddles}
              channelNotificationPrefs={channelNotificationPrefs}
              onSetNotificationLevel={onSetNotificationLevel}
            />
          );
        })()}

        <GroupSections
          sections={groupSections}
          channels={channels}
          activeChannelId={activeChannelId}
          unreadCounts={unreadCounts}
          onSelectChannel={onSelectChannel}
        />

        <ChannelList
          activeChannelId={activeChannelId}
          onSelectChannel={onSelectChannel}
          channels={visibleChannels}
          unreadCounts={unreadCounts}
          collapsed={sidebarCollapse.channels}
          onToggleCollapsed={toggleChannelsCollapsed}
          onCreateChannel={() => setCreateChannelOpen(true)}
          onBrowseChannels={() => setBrowseChannelsOpen(true)}
          activeHuddles={activeHuddles}
          channelNotificationPrefs={channelNotificationPrefs}
          onSetNotificationLevel={onSetNotificationLevel}
        />

        <DmList
          activeDmId={activeDmId}
          activeGroupDmId={activeGroupDmId}
          onSelectDm={onSelectDm}
          onSelectGroupDm={onSelectGroupDm}
          dms={visibleDms}
          groupDms={visibleGroupDms}
          currentUserId={currentUserId}
          onNewDm={() => onSelectComposeView?.()}
          unreadCounts={unreadCounts}
          presence={presence}
          collapsed={sidebarCollapse.dms}
          onToggleCollapsed={toggleDmsCollapsed}
          activeHuddles={activeHuddles}
        />

        {query && visibleChannels.length === 0 && visibleDms.length === 0 && visibleGroupDms.length === 0 && (
          <div className="px-4 py-3 text-[13px] text-sidebar-muted">No matches for &ldquo;{filter}&rdquo;</div>
        )}
      </div>

      {/* Invite footer */}
      {onOpenInvite && (
        <div className={clsx("shrink-0 border-t border-sidebar-border p-3")}>
          <p className="text-[13px] text-sidebar-muted mb-2 leading-snug">
            OpenSlaq works better when you use it together.
          </p>
          <button
            type="button"
            onClick={onOpenInvite}
            data-testid="sidebar-invite-button"
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-sidebar-border bg-transparent text-[13px] font-medium text-sidebar-text hover:bg-sidebar-hover cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite teammates
          </button>
        </div>
      )}

      <CreateChannelDialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onChannelCreated={(channel) => {
          setCreateChannelOpen(false);
          onChannelCreated?.(channel);
        }}
        workspaceSlug={workspaceSlug}
        canCreatePrivate={canManage}
      />

      <BrowseChannelsDialog
        open={browseChannelsOpen}
        onClose={() => setBrowseChannelsOpen(false)}
        workspaceSlug={workspaceSlug}
        isAdmin={canManage}
        onChannelJoined={(channel) => {
          onChannelCreated?.(channel);
        }}
      />
    </div>
  );
}
