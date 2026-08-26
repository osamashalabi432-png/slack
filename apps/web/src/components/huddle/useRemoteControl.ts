import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import { useDataChannel, useRoomContext } from "@livekit/components-react";
import {
  applyRemoteControl,
  canBeControlled,
  setRemoteControlEnabled,
  type ControlEvent,
} from "../../lib/remote-control";

export const REMOTE_CONTROL_TOPIC = "huddle-control";

/**
 * What the sharer publishes about their share. Control is only offered for a
 * whole monitor: a window or a browser tab is captured at an unknown offset on
 * the sharer's desktop, so a click could not be aimed accurately.
 */
export interface ShareCapability {
  surface: string;
  desktop: boolean;
}

type ControlMessage =
  | { t: "cap"; surface: string; desktop: boolean }
  | { t: "req" }
  | { t: "grant" }
  | { t: "deny" }
  | { t: "revoke" }
  | { t: "release" }
  | { t: "in"; events: ControlEvent[] };

export type ControlStatus = "idle" | "requesting" | "denied" | "active";

export interface RemoteControl {
  /** Sharer side: someone is asking, and has not been answered yet. */
  pendingRequest: string | null;
  /** Sharer side: identity currently driving this machine. */
  controlledBy: string | null;
  approve: () => void;
  deny: () => void;
  revoke: () => void;

  /** Viewer side. */
  status: ControlStatus;
  canRequest: boolean;
  /** Why the button is unavailable, when it is. */
  unavailableReason: string | null;
  requestControl: () => void;
  release: () => void;
  sendInput: (events: ControlEvent[]) => void;
}

interface Options {
  localIdentity: string;
  /** True while this participant is the one sharing. */
  isSharing: boolean;
  /** `displaySurface` from the local screen-share track, when sharing. */
  shareSurface?: string;
  /** Identity of whoever is sharing, local or remote. */
  sharerIdentity?: string;
}

export function useRemoteControl({
  localIdentity,
  isSharing,
  shareSurface,
  sharerIdentity,
}: Options): RemoteControl {
  const room = useRoomContext();
  const [capabilities, setCapabilities] = useState<Record<string, ShareCapability>>({});
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [controlledBy, setControlledBy] = useState<string | null>(null);
  const [status, setStatus] = useState<ControlStatus>("idle");

  const controlledByRef = useRef<string | null>(null);
  controlledByRef.current = controlledBy;

  const isSharingRef = useRef(isSharing);
  isSharingRef.current = isSharing;

  const { send } = useDataChannel(REMOTE_CONTROL_TOPIC, (msg) => {
    const from = msg.from?.identity;
    if (!from) return;
    let payload: ControlMessage;
    try {
      payload = JSON.parse(new TextDecoder().decode(msg.payload)) as ControlMessage;
    } catch {
      return;
    }

    switch (payload.t) {
      case "cap":
        setCapabilities((prev) => ({
          ...prev,
          [from]: { surface: payload.surface, desktop: payload.desktop },
        }));
        break;
      case "req":
        // Only entertain requests aimed at a screen we are actually sharing.
        if (isSharingRef.current && !controlledByRef.current) setPendingRequest(from);
        break;
      case "grant":
        setStatus("active");
        break;
      case "deny":
        setStatus("denied");
        break;
      case "revoke":
        setStatus("idle");
        break;
      case "release":
        if (controlledByRef.current === from) {
          setControlledBy(null);
          void setRemoteControlEnabled(false);
        }
        break;
      case "in":
        if (controlledByRef.current === from) void applyRemoteControl(payload.events);
        break;
    }
  });

  const post = useCallback(
    (message: ControlMessage, to?: string, reliable = true) => {
      try {
        send?.(new TextEncoder().encode(JSON.stringify(message)), {
          reliable,
          destinationIdentities: to ? [to] : undefined,
        });
      } catch {
        // A dropped control message is not worth interrupting the call for.
      }
    },
    [send],
  );

  // Tell the room what kind of share this is, and repeat it for late joiners.
  useEffect(() => {
    if (!isSharing) return;
    const announce = () =>
      post({ t: "cap", surface: shareSurface ?? "unknown", desktop: canBeControlled() });
    announce();
    room.on(RoomEvent.ParticipantConnected, announce);
    return () => {
      room.off(RoomEvent.ParticipantConnected, announce);
    };
  }, [isSharing, shareSurface, post, room]);

  // Stopping the share, or the controller leaving, ends control immediately.
  useEffect(() => {
    if (isSharing) return;
    setPendingRequest(null);
    setControlledBy(null);
    void setRemoteControlEnabled(false);
  }, [isSharing]);

  useEffect(() => {
    const onLeave = (participant: { identity: string }) => {
      if (controlledByRef.current === participant.identity) {
        setControlledBy(null);
        void setRemoteControlEnabled(false);
      }
      setPendingRequest((prev) => (prev === participant.identity ? null : prev));
      setCapabilities((prev) => {
        if (!(participant.identity in prev)) return prev;
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    };
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room]);

  // The viewer's own session ends when the person sharing stops.
  useEffect(() => {
    if (!sharerIdentity && status !== "idle") setStatus("idle");
  }, [sharerIdentity, status]);

  const approve = useCallback(() => {
    if (!pendingRequest) return;
    setControlledBy(pendingRequest);
    setPendingRequest(null);
    void setRemoteControlEnabled(true);
    post({ t: "grant" }, pendingRequest);
  }, [pendingRequest, post]);

  const deny = useCallback(() => {
    if (!pendingRequest) return;
    post({ t: "deny" }, pendingRequest);
    setPendingRequest(null);
  }, [pendingRequest, post]);

  const revoke = useCallback(() => {
    const target = controlledByRef.current;
    setControlledBy(null);
    void setRemoteControlEnabled(false);
    if (target) post({ t: "revoke" }, target);
  }, [post]);

  const remoteSharer = sharerIdentity && sharerIdentity !== localIdentity ? sharerIdentity : null;
  const capability = remoteSharer ? capabilities[remoteSharer] : undefined;

  let unavailableReason: string | null = null;
  if (remoteSharer) {
    if (!capability) unavailableReason = "Waiting for the sharer's app to report its screen";
    else if (!capability.desktop) unavailableReason = "Screen control needs the desktop app";
    else if (capability.surface !== "monitor")
      unavailableReason = "Only a full screen share can be controlled";
  }
  const canRequest = !!remoteSharer && !unavailableReason;

  const requestControl = useCallback(() => {
    if (!remoteSharer) return;
    setStatus("requesting");
    post({ t: "req" }, remoteSharer);
  }, [remoteSharer, post]);

  const release = useCallback(() => {
    setStatus("idle");
    if (remoteSharer) post({ t: "release" }, remoteSharer);
  }, [remoteSharer, post]);

  const sendInput = useCallback(
    (events: ControlEvent[]) => {
      if (!remoteSharer || events.length === 0) return;
      // Pointer streams go lossy; a dropped move is corrected by the next one.
      const reliable = !events.every((e) => e.kind === "move");
      post({ t: "in", events }, remoteSharer, reliable);
    },
    [remoteSharer, post],
  );

  return {
    pendingRequest,
    controlledBy,
    approve,
    deny,
    revoke,
    status,
    canRequest,
    unavailableReason,
    requestControl,
    release,
    sendInput,
  };
}
