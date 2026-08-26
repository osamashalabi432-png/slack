import { useEffect, useMemo, useState } from "react";
import { Hash, Lock, X, UserPlus, Trash2 } from "lucide-react";
import type { UserGroupDetail } from "@openslaq/shared";
import { listWorkspaceMembers, browseChannels, type WorkspaceMember, type BrowseChannel } from "@openslaq/client-core";
import { api } from "../../api";
import { useAuthProvider } from "../../lib/api-client";
import { Dialog, DialogContent, DialogTitle, Button, Avatar, useConfirm } from "../ui";
import type { UserGroupActions } from "../../hooks/chat/useUserGroups";

interface Props {
  groupId: string;
  workspaceSlug: string;
  canManage: boolean;
  actions: UserGroupActions;
  onClose: () => void;
}

/**
 * A group's roster and channels. Every control here changes who can read those
 * channels, so it is admin-only and each removal says what it will cost.
 */
export function UserGroupDetailDialog({
  groupId,
  workspaceSlug,
  canManage,
  actions,
  onClose,
}: Props) {
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [detail, setDetail] = useState<UserGroupDetail | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [channels, setChannels] = useState<BrowseChannel[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void actions.getGroup(groupId).then(setDetail);
    void listWorkspaceMembers(deps, workspaceSlug).then(setMembers);
    void browseChannels(deps, workspaceSlug).then(setChannels);
  }, [actions, groupId, deps, workspaceSlug]);

  const run = async (fn: () => Promise<UserGroupDetail>) => {
    setBusy(true);
    try {
      setDetail(await fn());
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return null;

  const memberIds = new Set(detail.members.map((m) => m.userId as string));
  const channelIds = new Set(detail.channels.map((c) => c.channelId as string));
  const addableMembers = members.filter((m) => !memberIds.has(m.id));
  const addableChannels = channels.filter((c) => !channelIds.has(c.id));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">
        <div className="px-6 pt-6 pb-4 border-b border-border-default shrink-0">
        <DialogTitle>
          {detail.name} <span className="text-muted font-normal">@{detail.handle}</span>
        </DialogTitle>
        {detail.purpose && <p className="text-sm text-secondary mt-1">{detail.purpose}</p>}
        </div>

        <div className="grid grid-cols-2 gap-6 px-6 py-5 max-h-[60vh] overflow-y-auto">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-primary">
              Members ({detail.members.length})
            </h3>
            <div className="flex flex-col gap-1" data-testid="group-members">
              {detail.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover"
                >
                  <Avatar src={member.avatarUrl} fallback={member.displayName} size="sm" />
                  <span className="text-sm text-primary truncate flex-1">
                    {member.displayName}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => actions.removeMember(groupId, member.userId as string))
                      }
                      aria-label={`Remove ${member.displayName}`}
                      data-testid={`group-remove-member-${member.userId}`}
                      className="p-1 rounded text-muted hover:text-danger-text bg-transparent border-none cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {detail.members.length === 0 && (
                <p className="text-xs text-muted px-2">Nobody yet.</p>
              )}
            </div>

            {canManage && addableMembers.length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-secondary cursor-pointer flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />
                  Add people
                </summary>
                <div className="mt-1 max-h-40 overflow-y-auto flex flex-col">
                  {addableMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => actions.addMembers(groupId, [member.id]))}
                      data-testid={`group-add-member-${member.id}`}
                      className="text-left text-sm px-2 py-1.5 rounded-md hover:bg-surface-hover bg-transparent border-none cursor-pointer text-primary"
                    >
                      {member.displayName}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-primary">
              Channels ({detail.channels.length})
            </h3>
            <div className="flex flex-col gap-1" data-testid="group-channels">
              {detail.channels.map((channel) => (
                <div
                  key={channel.channelId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover"
                >
                  {channel.isPrivate ? (
                    <Lock className="w-3.5 h-3.5 text-muted shrink-0" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 text-muted shrink-0" />
                  )}
                  <span className="text-sm text-primary truncate flex-1">{channel.name}</span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove #${channel.name} from ${detail.name}?`,
                          description:
                            "Members who only reach this channel through this group will lose access. The channel stays private and keeps its history.",
                          confirmLabel: "Remove",
                        });
                        if (ok) {
                          void run(() =>
                            actions.removeChannel(groupId, channel.channelId as string),
                          );
                        }
                      }}
                      aria-label={`Remove ${channel.name}`}
                      data-testid={`group-remove-channel-${channel.channelId}`}
                      className="p-1 rounded text-muted hover:text-danger-text bg-transparent border-none cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {detail.channels.length === 0 && (
                <p className="text-xs text-muted px-2">No channels yet.</p>
              )}
            </div>

            {canManage && addableChannels.length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-secondary cursor-pointer">Add a channel</summary>
                <div className="mt-1 max-h-40 overflow-y-auto flex flex-col">
                  {addableChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => actions.addChannels(groupId, [channel.id]))}
                      data-testid={`group-add-channel-${channel.id}`}
                      className="text-left text-sm px-2 py-1.5 rounded-md hover:bg-surface-hover bg-transparent border-none cursor-pointer text-primary"
                    >
                      {channel.type === "private" ? "🔒" : "#"} {channel.name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-border-default shrink-0">
          {canManage ? (
            <Button
              variant="danger"
              disabled={busy}
              data-testid="group-delete"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${detail.name}?`,
                  description:
                    "The group's channels stay private with the people currently in them — nothing is deleted or emptied.",
                  confirmLabel: "Delete group",
                });
                if (ok) {
                  await actions.remove(groupId);
                  onClose();
                }
              }}
            >
              Delete group
            </Button>
          ) : (
            <span className="text-xs text-muted">Only admins can change a group.</span>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
