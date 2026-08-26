import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import { useDataChannel, useRoomContext } from "@livekit/components-react";
import { DEFAULT_HUDDLE_BACKGROUND_ID } from "./huddle-backgrounds";

/** Ephemeral huddle UI state, shared over the LiveKit data channel. */
export const HUDDLE_SIGNAL_TOPIC = "huddle-ui";

/** How long a reaction stays on someone's tile. */
const REACTION_MS = 4000;

/** Give a late joiner a moment to wire up before re-announcing state to them. */
const REANNOUNCE_MS = 600;

export type HuddleSignal =
  | { t: "bg"; id: string }
  | { t: "hand"; raised: boolean }
  | { t: "reaction"; emoji: string };

export interface HuddleSignals {
  backgroundId: string;
  setBackground: (id: string) => void;
  raisedHands: Record<string, boolean>;
  handRaised: boolean;
  toggleHand: () => void;
  /** Latest reaction per participant identity, cleared after a few seconds. */
  reactions: Record<string, string>;
  sendReaction: (emoji: string) => void;
}

/**
 * Background, raised hands and reactions are presentation-only and vanish with
 * the call, so they ride the data channel rather than the database. Nothing is
 * echoed back to the sender, so every action is applied locally as well.
 */
export function useHuddleSignals(localIdentity: string): HuddleSignals {
  const room = useRoomContext();
  const [backgroundId, setBackgroundId] = useState(DEFAULT_HUDDLE_BACKGROUND_ID);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const backgroundRef = useRef(backgroundId);
  const handRef = useRef(false);
  // Only the person who picked the background replays it for late joiners,
  // so a room full of clients does not all shout the same value.
  const ownsBackground = useRef(false);

  backgroundRef.current = backgroundId;
  handRef.current = !!raisedHands[localIdentity];

  const showReaction = useCallback((identity: string, emoji: string) => {
    setReactions((prev) => ({ ...prev, [identity]: emoji }));
    clearTimeout(timers.current[identity]);
    timers.current[identity] = setTimeout(() => {
      setReactions((prev) => {
        const next = { ...prev };
        delete next[identity];
        return next;
      });
    }, REACTION_MS);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
    };
  }, []);

  const apply = useCallback(
    (identity: string, signal: HuddleSignal) => {
      if (signal.t === "bg") setBackgroundId(signal.id);
      else if (signal.t === "hand") setRaisedHands((prev) => ({ ...prev, [identity]: signal.raised }));
      else showReaction(identity, signal.emoji);
    },
    [showReaction],
  );

  const { send } = useDataChannel(HUDDLE_SIGNAL_TOPIC, (msg) => {
    const identity = msg.from?.identity;
    if (!identity) return;
    try {
      apply(identity, JSON.parse(new TextDecoder().decode(msg.payload)) as HuddleSignal);
    } catch {
      // A malformed payload from another client should never break the call.
    }
  });

  const broadcast = useCallback(
    (signal: HuddleSignal) => {
      try {
        send?.(new TextEncoder().encode(JSON.stringify(signal)), { reliable: true });
      } catch {
        // Sending before the room is fully connected is not worth surfacing.
      }
    },
    [send],
  );

  const setBackground = useCallback(
    (id: string) => {
      setBackgroundId(id);
      ownsBackground.current = true;
      broadcast({ t: "bg", id });
    },
    [broadcast],
  );

  const toggleHand = useCallback(() => {
    const raised = !handRef.current;
    setRaisedHands((prev) => ({ ...prev, [localIdentity]: raised }));
    broadcast({ t: "hand", raised });
  }, [broadcast, localIdentity]);

  const sendReaction = useCallback(
    (emoji: string) => {
      showReaction(localIdentity, emoji);
      broadcast({ t: "reaction", emoji });
    },
    [broadcast, localIdentity, showReaction],
  );

  // Someone joining mid-call missed every signal sent so far.
  useEffect(() => {
    const onJoin = () => {
      setTimeout(() => {
        if (ownsBackground.current) broadcast({ t: "bg", id: backgroundRef.current });
        if (handRef.current) broadcast({ t: "hand", raised: true });
      }, REANNOUNCE_MS);
    };
    const onLeave = (participant: { identity: string }) => {
      setRaisedHands((prev) => {
        if (!(participant.identity in prev)) return prev;
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room, broadcast]);

  return {
    backgroundId,
    setBackground,
    raisedHands,
    handRaised: !!raisedHands[localIdentity],
    toggleHand,
    reactions,
    sendReaction,
  };
}
