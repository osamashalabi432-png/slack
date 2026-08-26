import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Hash, Lock, UsersRound } from "lucide-react";
import type { Channel, SidebarGroupSection } from "@openslaq/shared";

interface GroupSectionsProps {
  sections: SidebarGroupSection[];
  channels: Channel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  onSelectChannel: (channelId: string) => void;
}

/**
 * A heading per group the user belongs to, with that group's channels under
 * it — the sidebar mirror of "Marketing Team owns #marketing". Groups that opt
 * out, or whose channels the viewer cannot see, simply do not appear.
 */
export function GroupSections({
  sections,
  channels,
  activeChannelId,
  unreadCounts,
  onSelectChannel,
}: GroupSectionsProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const byId = new Map(channels.map((c) => [c.id as string, c]));

  const visible = sections
    .map((section) => ({
      ...section,
      channels: section.channelIds
        .map((id) => byId.get(id as string))
        .filter((c): c is Channel => Boolean(c)),
    }))
    .filter((section) => section.channels.length > 0);

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((section) => {
        const isCollapsed = collapsed[section.groupId as string] ?? false;
        return (
          <div key={section.groupId} className="py-2 px-2" data-testid={`group-sidebar-section-${section.groupId}`}>
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [section.groupId as string]: !isCollapsed,
                }))
              }
              className="group w-full px-2 py-1 text-[13px] text-gray-400 font-semibold flex items-center gap-1 hover:bg-white/10 rounded-md bg-transparent border-none cursor-pointer text-left"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0" />
              )}
              <UsersRound className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{section.name}</span>
            </button>

            {!isCollapsed &&
              section.channels.map((channel) => {
                const unread = unreadCounts[channel.id as string] ?? 0;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectChannel(channel.id as string)}
                    data-testid={`group-section-channel-${channel.id}`}
                    className={clsx(
                      "flex w-full items-center justify-between py-1 pl-4 pr-2 rounded-md border-none text-white text-left cursor-pointer text-sm",
                      activeChannelId === channel.id
                        ? "bg-white/15"
                        : "bg-transparent hover:bg-white/10",
                    )}
                  >
                    <span className={clsx("flex items-center gap-1.5", unread > 0 && "font-bold")}>
                      {channel.type === "private" ? (
                        <Lock className="w-3 h-3 shrink-0" />
                      ) : (
                        <Hash className="w-3 h-3 shrink-0" />
                      )}
                      {channel.name}
                    </span>
                    {unread > 0 && (
                      <span className="ml-auto text-[11px] font-bold bg-sidebar-accent text-black rounded-full px-1.5 py-0.5 leading-none">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        );
      })}
    </>
  );
}
