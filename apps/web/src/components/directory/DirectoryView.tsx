import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Users, Hash, UsersRound, Search, Lock, Check, UserRound } from "lucide-react";
import { listWorkspaceMembers, browseChannels, type WorkspaceMember } from "@openslaq/client-core";
import type { BrowseChannel } from "@openslaq/client-core";
import type { UserGroup } from "@openslaq/shared";
import type { PresenceEntry } from "@openslaq/client-core";
import { api } from "../../api";
import { useAuthProvider } from "../../lib/api-client";
import { Button } from "../ui";
import type { UserGroupActions } from "../../hooks/chat/useUserGroups";
import { CreateUserGroupDialog } from "./CreateUserGroupDialog";
import { UserGroupDetailDialog } from "./UserGroupDetailDialog";
import { CreateChannelDialog } from "../channel/CreateChannelDialog";

type DirectoryTab = "people" | "channels" | "groups";

const TABS: { id: DirectoryTab; label: string; icon: typeof Users }[] = [
  { id: "people", label: "People", icon: Users },
  { id: "channels", label: "Channels", icon: Hash },
  { id: "groups", label: "User Groups", icon: UsersRound },
];

interface DirectoryViewProps {
  workspaceSlug: string;
  canManage: boolean;
  currentUserId: string;
  presence: Record<string, PresenceEntry | undefined>;
  /** Shared with the sidebar so both update together. */
  groupActions: UserGroupActions;
  onOpenInvite: () => void;
  onOpenDm: (userId: string) => void;
  onSelectChannel: (channelId: string) => void;
}

function SearchBar({
  value,
  onChange,
  placeholder,
  action,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className="flex-1 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid="directory-search"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border-input bg-surface text-primary text-sm outline-none focus:border-slaq-blue"
        />
      </div>
      {action && (
        <Button onClick={action.onClick} data-testid="directory-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}

type PeopleSort = "recommended" | "name";

function PeopleTab({
  workspaceSlug,
  query,
  currentUserId,
  presence,
  onOpenDm,
}: {
  workspaceSlug: string;
  query: string;
  currentUserId: string;
  presence: Record<string, PresenceEntry | undefined>;
  onOpenDm: (userId: string) => void;
}) {
  const [sort, setSort] = useState<PeopleSort>("recommended");
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listWorkspaceMembers(deps, workspaceSlug).then((list) => {
      if (!cancelled) setMembers(list);
    });
    return () => {
      cancelled = true;
    };
  }, [deps, workspaceSlug]);

  const filtered = members
    .filter((m) => `${m.displayName} ${m.email ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    // "Recommended" puts you first, then everyone alphabetically — there is no
    // ranking signal to invent one from.
    .sort((a, b) => {
      if (sort === "recommended") {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

  return (
    <>
      <div className="flex items-center justify-between px-6 pb-3">
        <span className="text-xs text-muted">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
        </span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PeopleSort)}
          data-testid="directory-people-sort"
          className="h-8 px-2 rounded-md border border-border-default bg-surface text-sm text-secondary cursor-pointer"
        >
          <option value="recommended">Most recommended</option>
          <option value="name">A to Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted">No people match that search.</p>
      ) : (
        <div className="flex flex-wrap gap-4 px-6 pb-6">
          {filtered.map((member) => {
                    const online = presence[member.id]?.online ?? false;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onOpenDm(member.id)}
                data-testid={`directory-person-${member.id}`}
                className="w-[150px] flex flex-col rounded-lg border border-border-default bg-surface overflow-hidden hover:bg-surface-hover cursor-pointer text-left transition-colors p-0"
              >
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="w-[150px] h-[150px] object-cover block"
                  />
                ) : (
                  <span className="w-[150px] h-[150px] bg-avatar-fallback-bg flex items-center justify-center">
                    <UserRound className="w-20 h-20 text-white/90" strokeWidth={1.5} />
                  </span>
                )}
                <span className="flex items-start gap-1.5 px-3 py-2.5">
                  <span className="text-sm font-bold text-primary leading-snug break-words">
                    {member.displayName}
                    {member.id === currentUserId ? " (you)" : ""}
                  </span>
                  <span
                    aria-label={online ? "Online" : "Away"}
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full shrink-0 mt-1 border",
                      online ? "bg-green-500 border-green-500" : "border-muted bg-transparent",
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function ChannelsTab({
  workspaceSlug,
  query,
  onSelectChannel,
}: {
  workspaceSlug: string;
  query: string;
  onSelectChannel: (channelId: string) => void;
}) {
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);
  const [channels, setChannels] = useState<BrowseChannel[]>([]);

  useEffect(() => {
    let cancelled = false;
    void browseChannels(deps, workspaceSlug).then((list) => {
      if (!cancelled) setChannels(list);
    });
    return () => {
      cancelled = true;
    };
  }, [deps, workspaceSlug]);

  const filtered = channels.filter((c) =>
    `${c.name} ${c.description ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  if (filtered.length === 0) {
    return <p className="px-6 py-8 text-sm text-muted">No channels match that search.</p>;
  }

  return (
    <div className="px-6 pb-6 flex flex-col gap-2">
      {filtered.map((channel) => (
        <button
          key={channel.id}
          type="button"
          onClick={() => onSelectChannel(channel.id)}
          data-testid={`directory-channel-${channel.id}`}
          className="flex flex-col gap-1 py-3 px-4 rounded-lg border border-border-default bg-surface-secondary hover:bg-surface-hover cursor-pointer text-left transition-colors"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            {channel.type === "private" ? (
              <Lock className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Hash className="w-3.5 h-3.5 shrink-0" />
            )}
            {channel.name}
          </span>
          <span className="flex items-center gap-2 text-xs text-muted">
            {channel.isMember && (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="w-3 h-3" />
                Joined
              </span>
            )}
            <span>
              {channel.memberCount} member{channel.memberCount === 1 ? "" : "s"}
            </span>
            {channel.description && <span className="truncate">· {channel.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function GroupsTab({
  groups,
  query,
  onOpen,
}: {
  groups: UserGroup[];
  query: string;
  onOpen: (group: UserGroup) => void;
}) {
  const filtered = groups.filter((g) =>
    `${g.name} ${g.handle} ${g.purpose ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  if (filtered.length === 0) {
    return (
      <p className="px-6 py-8 text-sm text-muted" data-testid="directory-groups-empty">
        No user groups yet. A group bundles people with the channels they should reach.
      </p>
    );
  }

  return (
    <div className="px-6 pb-6 flex flex-col gap-2">
      {filtered.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onOpen(group)}
          data-testid={`directory-group-${group.id}`}
          className="flex flex-col gap-1 py-3 px-4 rounded-lg border border-border-default bg-surface-secondary hover:bg-surface-hover cursor-pointer text-left transition-colors"
        >
          <span className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-primary">{group.name}</span>
            <span className="text-muted">@{group.handle}</span>
            {group.isMember && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-selected text-secondary">
                You&apos;re in this
              </span>
            )}
          </span>
          <span className="text-xs text-muted">
            {group.memberCount} member{group.memberCount === 1 ? "" : "s"} ·{" "}
            {group.channelCount} channel{group.channelCount === 1 ? "" : "s"}
            {group.purpose ? ` · ${group.purpose}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The workspace directory: who is here, what channels exist, and the groups
 * that tie the two together. Groups are the access rule — a group's channels
 * are private and its roster is who can read them — so this is also where an
 * admin grants and revokes access.
 */
export function DirectoryView({
  workspaceSlug,
  canManage,
  currentUserId,
  presence,
  groupActions,
  onOpenInvite,
  onOpenDm,
  onSelectChannel,
}: DirectoryViewProps) {
  const [tab, setTab] = useState<DirectoryTab>("people");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<UserGroup | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const action =
    tab === "people"
      ? { label: "Invite People", onClick: onOpenInvite }
      : tab === "channels"
        ? { label: "Create Channel", onClick: () => setCreateChannelOpen(true) }
        : canManage
          ? { label: "Create user group", onClick: () => setCreateOpen(true) }
          : undefined;

  const placeholder =
    tab === "people"
      ? "Search for people"
      : tab === "channels"
        ? "Search for channels"
        : "Search by team name, project or department";

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto" data-testid="directory-view">
      <div className="px-6 pt-5 shrink-0">
        <h1 className="text-xl font-bold text-primary">Directories</h1>
        <div className="flex items-center gap-1 mt-3 border-b border-border-default">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
              data-testid={`directory-tab-${id}`}
              aria-selected={tab === id}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 text-sm border-none bg-transparent cursor-pointer -mb-px border-b-2 transition-colors",
                tab === id
                  ? "text-primary font-semibold border-b-slaq-blue"
                  : "text-secondary border-b-transparent hover:text-primary",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder={placeholder} action={action} />

      {tab === "people" && (
        <PeopleTab
          workspaceSlug={workspaceSlug}
          query={query}
          currentUserId={currentUserId}
          presence={presence}
          onOpenDm={onOpenDm}
        />
      )}
      {tab === "channels" && (
        <ChannelsTab
          workspaceSlug={workspaceSlug}
          query={query}
          onSelectChannel={onSelectChannel}
        />
      )}
      {tab === "groups" && (
        <GroupsTab groups={groupActions.groups} query={query} onOpen={setOpenGroup} />
      )}

      <CreateChannelDialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onChannelCreated={(channel) => {
          setCreateChannelOpen(false);
          onSelectChannel(channel.id);
        }}
        workspaceSlug={workspaceSlug}
        canCreatePrivate={canManage}
      />

      <CreateUserGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceSlug={workspaceSlug}
        onCreate={groupActions.create}
      />

      {openGroup && (
        <UserGroupDetailDialog
          groupId={openGroup.id}
          workspaceSlug={workspaceSlug}
          canManage={canManage}
          actions={groupActions}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}
