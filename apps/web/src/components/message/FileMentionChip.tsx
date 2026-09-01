import { useCallback, useEffect, useState } from "react";
import { FileText, Link2, Loader2 } from "lucide-react";
import type { FolderRef } from "@openslaq/shared";
import { fetchFolderRef } from "@openslaq/client-core";
import { useOperationDeps } from "../../hooks/chat/useOperationDeps";

interface FileMentionChipProps {
  tabId: string;
  itemId: string;
  /** Absent when the message is shown outside its channel (e.g. a forward). */
  workspaceSlug?: string;
  channelId?: string;
}

function startDownload(ref: FolderRef) {
  if (ref.kind === "link") {
    window.open(ref.downloadUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const a = document.createElement("a");
  a.href = ref.downloadUrl;
  a.download = ref.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * A folder file @-mentioned in a message. Clicking it re-resolves a fresh
 * signed URL (they expire) and downloads the file — or opens the link.
 */
export function FileMentionChip({ tabId, itemId, workspaceSlug, channelId }: FileMentionChipProps) {
  const deps = useOperationDeps();
  const [ref, setRef] = useState<FolderRef | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const scoped = Boolean(workspaceSlug && channelId);

  useEffect(() => {
    if (!scoped) return;
    let cancelled = false;
    fetchFolderRef(deps, { workspaceSlug: workspaceSlug!, channelId: channelId!, tabId, itemId })
      .then((r) => {
        if (!cancelled) setRef(r);
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [deps, scoped, workspaceSlug, channelId, tabId, itemId]);

  const onClick = useCallback(() => {
    if (!scoped || state === "loading") return;
    setState("loading");
    // Always re-resolve: a signed file URL fetched on mount may have expired
    // by the time someone clicks it hours later.
    fetchFolderRef(deps, { workspaceSlug: workspaceSlug!, channelId: channelId!, tabId, itemId })
      .then((r) => {
        setRef(r);
        setState("idle");
        startDownload(r);
      })
      .catch(() => setState("error"));
  }, [deps, scoped, state, workspaceSlug, channelId, tabId, itemId]);

  const Icon = state === "loading" ? Loader2 : ref?.kind === "link" ? Link2 : FileText;
  const label =
    state === "error"
      ? "File unavailable"
      : ref?.name ?? (scoped ? "Loading…" : "File");

  const base =
    "inline-flex items-center gap-1 rounded px-1 font-medium text-[13px] align-baseline bg-[#1264a31a] text-slaq-blue";

  if (!scoped || state === "error") {
    return (
      <span className={base} data-testid="file-mention" data-state={state}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="file-mention"
      onClick={onClick}
      title={ref ? `Download ${ref.name}` : "Resolving file…"}
      className={`${base} border-none cursor-pointer hover:underline disabled:cursor-progress`}
      disabled={state === "loading" && ref === null}
    >
      <Icon className={`w-3.5 h-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
