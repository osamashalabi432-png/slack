import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Hash, Lock } from "lucide-react";
import { handleFromName, isValidGroupHandle } from "@openslaq/shared";
import type { UserGroup } from "@openslaq/shared";
import { browseChannels, type BrowseChannel } from "@openslaq/client-core";
import { api } from "../../api";
import { useAuthProvider } from "../../lib/api-client";
import { Dialog, DialogContent, DialogTitle, Button, Input, Switch } from "../ui";

interface CreateUserGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onCreate: (input: {
    name: string;
    handle: string;
    purpose?: string | null;
    showAsSection?: boolean;
    channelIds?: string[];
  }) => Promise<UserGroup>;
}

export function CreateUserGroupDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onCreate,
}: CreateUserGroupDialogProps) {
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [showAsSection, setShowAsSection] = useState(true);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<BrowseChannel[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setHandle("");
    setHandleEdited(false);
    setPurpose("");
    setShowAsSection(true);
    setChannelIds([]);
    setError(null);
    void browseChannels(deps, workspaceSlug).then(setChannels);
  }, [open, deps, workspaceSlug]);

  // The handle follows the name until someone types their own.
  useEffect(() => {
    if (!handleEdited) setHandle(handleFromName(name));
  }, [name, handleEdited]);

  const chosen = channels.filter((c) => channelIds.includes(c.id));
  const willBecomePrivate = chosen.filter((c) => c.type !== "private");
  const handleValid = handle.length === 0 || isValidGroupHandle(handle);
  const canSubmit = name.trim().length > 0 && isValidGroupHandle(handle) && !saving;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        handle,
        purpose: purpose.trim() || null,
        showAsSection,
        channelIds: channelIds.length > 0 ? channelIds : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <div className="px-6 pt-6 pb-4 border-b border-border-default shrink-0">
          <DialogTitle>Create User Group</DialogTitle>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5 max-h-[60vh] overflow-y-auto">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-primary">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing Team"
              data-testid="group-name-input"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-primary">Handle</span>
            <div className="flex items-center gap-1">
              <span className="text-muted">@</span>
              <Input
                value={handle}
                onChange={(e) => {
                  setHandleEdited(true);
                  setHandle(e.target.value.toLowerCase());
                }}
                placeholder="e.g. marketing-team"
                data-testid="group-handle-input"
              />
            </div>
            <span className={handleValid ? "text-xs text-muted" : "text-xs text-danger-text"}>
              {handleValid
                ? "Mention the whole group by typing this after an @. Lowercase, no spaces."
                : "Lowercase letters, numbers and dashes only, 3-32 characters."}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-primary">
              Purpose <span className="font-normal text-muted">(optional)</span>
            </span>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is this group about?"
              data-testid="group-purpose-input"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-primary">Channels</span>
            <span className="text-xs text-muted">
              Group members are added to these channels automatically, and only group members can
              reach them.
            </span>
            <div className="max-h-52 overflow-y-auto flex flex-col gap-1.5 p-1">
              {channels.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted">No channels available.</p>
              )}
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className={
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors " +
                    (channelIds.includes(channel.id)
                      ? "border-slaq-blue bg-surface-selected"
                      : "border-border-default bg-surface hover:bg-surface-hover")
                  }
                >
                  <input
                    type="checkbox"
                    checked={channelIds.includes(channel.id)}
                    onChange={(e) =>
                      setChannelIds((prev) =>
                        e.target.checked
                          ? [...prev, channel.id]
                          : prev.filter((id) => id !== channel.id),
                      )
                    }
                    data-testid={`group-channel-${channel.id}`}
                  />
                  {channel.type === "private" ? (
                    <Lock className="w-3.5 h-3.5 text-muted" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 text-muted" />
                  )}
                  <span className="text-sm text-primary">{channel.name}</span>
                </label>
              ))}
            </div>
          </div>

          {willBecomePrivate.length > 0 && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg bg-highlight-bg text-sm"
              data-testid="group-privacy-warning"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span className="text-secondary">
                {willBecomePrivate.map((c) => `#${c.name}`).join(", ")}{" "}
                {willBecomePrivate.length === 1 ? "is public and will become" : "are public and will become"}{" "}
                private. Everyone currently in {willBecomePrivate.length === 1 ? "it" : "them"} keeps
                access; nobody else will see {willBecomePrivate.length === 1 ? "it" : "them"} unless
                they are in this group.
              </span>
            </div>
          )}

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border-default cursor-pointer">
            <Switch
              checked={showAsSection}
              onCheckedChange={setShowAsSection}
              data-testid="group-section-toggle"
            />
            <span>
              <span className="block text-sm font-semibold text-primary">
                Add group channels as a section in Home
              </span>
              <span className="block text-xs text-muted">
                Organise the channels into their own heading in the sidebar for group members.
              </span>
            </span>
          </label>

          {error && (
            <p className="text-sm text-danger-text" data-testid="group-create-error">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-default shrink-0">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="group-create-submit">
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
