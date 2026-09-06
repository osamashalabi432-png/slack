import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { CanvasContent } from "@openslaq/shared";
import { useSocket } from "../useSocket";

export interface CanvasCollab {
  ydoc: Y.Doc;
  awareness: Awareness;
  /** True once the initial sync from the relay has arrived. */
  ready: boolean;
}

interface Options {
  enabled: boolean;
  /** The page whose body is being edited — the collaboration room key. */
  pageId: string;
  /** The saved body, loaded into the shared doc by whichever client seeds it. */
  initialContent: CanvasContent | null;
  /** Called (with the saved content) when this client is asked to seed the doc. */
  onSeed: (content: CanvasContent | null) => void;
}

/**
 * Binds a Yjs document + awareness to the server's canvas relay so several
 * people can edit one canvas at once. The relay is schema-free: it just
 * forwards opaque Yjs updates between everyone in the room and hands late
 * joiners the merged state.
 */
export function useCanvasCollab({ enabled, pageId, initialContent, onSeed }: Options): CanvasCollab {
  const { socket } = useSocket();

  // A fresh shared doc per page — the id doesn't appear in the factory but it
  // must drive re-creation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ydoc = useMemo(() => new Y.Doc(), [pageId]);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);
  const [ready, setReady] = useState(false);

  const seedRef = useRef(onSeed);
  seedRef.current = onSeed;
  const contentRef = useRef(initialContent);
  contentRef.current = initialContent;

  // Tear the doc down when the page changes / the editor unmounts.
  useEffect(() => {
    return () => {
      awareness.destroy();
      ydoc.destroy();
    };
  }, [ydoc, awareness]);

  useEffect(() => {
    if (!enabled || !socket) return;
    setReady(false);

    const sendDoc = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      socket.emit("canvas:collab-update", { pageId, update });
    };
    ydoc.on("update", sendDoc);

    const sendAwareness = (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === "remote") return;
      const clients = [...changes.added, ...changes.updated, ...changes.removed];
      socket.emit("canvas:collab-awareness", {
        pageId,
        update: encodeAwarenessUpdate(awareness, clients),
      });
    };
    awareness.on("update", sendAwareness);

    const onSync = (p: { pageId: string; state: Uint8Array | null; seed: boolean }) => {
      if (p.pageId !== pageId) return;
      if (p.state) Y.applyUpdate(ydoc, new Uint8Array(p.state), "remote");
      if (p.seed) seedRef.current(contentRef.current);
      setReady(true);
    };
    const onDoc = (p: { pageId: string; update: Uint8Array }) => {
      if (p.pageId === pageId) Y.applyUpdate(ydoc, new Uint8Array(p.update), "remote");
    };
    const onAwareness = (p: { pageId: string; update: Uint8Array }) => {
      if (p.pageId === pageId) applyAwarenessUpdate(awareness, new Uint8Array(p.update), "remote");
    };

    socket.on("canvas:collab-sync", onSync);
    socket.on("canvas:collab-update", onDoc);
    socket.on("canvas:collab-awareness", onAwareness);
    socket.emit("canvas:collab-join", { pageId });

    return () => {
      socket.emit("canvas:collab-leave", { pageId });
      socket.off("canvas:collab-sync", onSync);
      socket.off("canvas:collab-update", onDoc);
      socket.off("canvas:collab-awareness", onAwareness);
      ydoc.off("update", sendDoc);
      awareness.off("update", sendAwareness);
    };
  }, [enabled, socket, pageId, ydoc, awareness]);

  return { ydoc, awareness, ready };
}
