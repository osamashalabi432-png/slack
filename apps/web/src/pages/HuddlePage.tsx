import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useConnectionState,
  useRoomContext,
  useTracks,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track, ConnectionState, VideoPresets, type RoomOptions, type Participant } from "livekit-client";
import { notifyHuddleLeave } from "@openslaq/client-core";
import * as Sentry from "@sentry/react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useAuthProvider } from "../lib/api-client";
import { api } from "../api";
import { useHuddleToken } from "../hooks/chat/useHuddleToken";
import { VideoGrid } from "../components/huddle/VideoGrid";
import { HuddleControlBar } from "../components/huddle/HuddleControlBar";
import { useHuddleSignals } from "../components/huddle/useHuddleSignals";
import { getHuddleBackground } from "../components/huddle/huddle-backgrounds";
import { useRemoteControl } from "../components/huddle/useRemoteControl";
import { RemoteControlContext } from "../components/huddle/remote-control-context";
import { RemoteControlPrompt } from "../components/huddle/RemoteControlPrompt";
import { classifyMediaError, type PermissionAlert } from "../lib/huddle-errors";
import type { HuddleParticipant } from "../components/huddle/VideoTile";
import { Radio } from "lucide-react";
import { isTauri } from "../lib/tauri";

function closeWindow() {
  if (isTauri()) {
    import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().close();
    });
  } else {
    window.close();
  }
}

const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
  publishDefaults: {
    videoEncoding: VideoPresets.h720.encoding,
    screenShareEncoding: VideoPresets.h1080.encoding,
  },
};

function toHuddleParticipant(
  p: Participant,
  isSpeaking: boolean,
  handRaised: boolean,
  reaction?: string,
): HuddleParticipant {
  let isMuted = true;
  for (const pub of p.trackPublications.values()) {
    if (pub.source === Track.Source.Microphone) {
      isMuted = pub.isMuted;
      break;
    }
  }
  return {
    identity: p.identity,
    name: p.name || p.identity,
    isMuted,
    isSpeaking,
    handRaised,
    reaction,
  };
}

interface HuddlePageProps {
  /** Supplied when docked in the app; falls back to the /huddle route param. */
  channelId?: string;
  channelName?: string;
  /** Fill the parent instead of the viewport, for the docked panel. */
  inline?: boolean;
  /** Narrow layout: show only the essential controls. */
  compact?: boolean;
  /** How to dismiss. Defaults to closing the window for the standalone route. */
  onClose?: () => void;
}

export function HuddlePage({
  channelId: channelIdProp,
  channelName: channelNameProp,
  inline = false,
  compact = false,
  onClose,
}: HuddlePageProps = {}) {
  const { channelId: routeChannelId } = useParams<{ channelId: string }>();
  const channelId = channelIdProp ?? routeChannelId;
  const user = useCurrentUser();
  const channelName =
    channelNameProp ?? new URLSearchParams(window.location.search).get("name") ?? "Huddle";
  const dismiss = onClose ?? closeWindow;
  const shellHeight = inline ? "h-full" : "h-screen";

  const { token, wsUrl, error: tokenError } = useHuddleToken(channelId, user);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  // Leaving has to stop the room reconnecting. On the standalone route the
  // window cannot always close itself, and a live room would quietly pull the
  // user back into the huddle they just left.
  const [hungUp, setHungUp] = useState(false);

  const leave = useCallback(() => {
    setHungUp(true);
    dismiss();
  }, [dismiss]);

  // useHuddleToken deliberately no-ops without a user and reports no error, so
  // nothing would ever be shown. Give the session a moment, then say so.
  useEffect(() => {
    if (user) {
      setAuthTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setAuthTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [user]);

  const error = tokenError ?? connectError;

  // A teammate can open this straight from the link, so point at the
  // standalone huddle route rather than wherever this window happens to be.
  const inviteLink = channelId
    ? `${window.location.origin}/huddle/${channelId}?name=${encodeURIComponent(channelName)}`
    : undefined;

  // The huddle opens in its own window, so reflect its state in the title.
  // Useful in the taskbar, and it makes a stalled window diagnosable from
  // outside the app when the webview shows nothing.
  useEffect(() => {
    let state: string;
    if (error) state = "error";
    else if (!user) state = authTimedOut ? "not signed in" : "signing in";
    else if (!token || !wsUrl) state = "connecting";
    else state = "connected";
    if (inline) return;
    document.title = `${channelName} · ${state}`;
  }, [error, user, authTimedOut, token, wsUrl, channelName, inline]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${shellHeight} bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white`}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => dismiss()}
            className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full hover:bg-white/20 text-white border-none cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (hungUp) {
    return (
      <div
        className={`flex items-center justify-center ${shellHeight} bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white`}
        data-testid="huddle-left"
      >
        <p className="text-white/60 text-sm">You left the huddle.</p>
      </div>
    );
  }

  if (!token || !wsUrl) {
    const stalled = !user && authTimedOut;
    return (
      <div
        className={`flex items-center justify-center ${shellHeight} bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white`}
        data-testid="huddle-pending"
      >
        <div className="text-center max-w-sm px-6">
          <p className={stalled ? "text-amber-300 mb-4" : "text-white/70 mb-4"}>
            {stalled
              ? "This huddle window isn't signed in. Make sure you're signed in to the main OpenSlaq window, then start the huddle again."
              : user
                ? "Connecting to the huddle…"
                : "Signing in…"}
          </p>
          {stalled && (
            <button
              type="button"
              onClick={() => dismiss()}
              className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full hover:bg-white/20 text-white border-none cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={wsUrl ?? undefined}
      token={token ?? undefined}
      connect={!!token && !!wsUrl}
      options={ROOM_OPTIONS}
      onError={(err) => {
        Sentry.captureException(err);
        setConnectError(`Could not connect to voice server (${err.message})`);
      }}
      // Render as a plain div wrapper
      data-lk-theme="default"
      style={{ height: inline ? "100%" : "100vh" }}
    >
      <RoomAudioRenderer />
      <HuddlePageContent
        channelName={channelName}
        shellHeight={shellHeight}
        compact={compact}
        inviteLink={inviteLink}
        onLeave={leave}
      />
    </LiveKitRoom>
  );
}

function HuddlePageContent({
  channelName,
  shellHeight,
  compact,
  inviteLink,
  onLeave,
}: {
  channelName: string;
  shellHeight: string;
  compact: boolean;
  inviteLink?: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const trackRefs = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const localIsSpeaking = useIsSpeaking(localParticipant);

  const [permissionAlert, setPermissionAlert] = useState<PermissionAlert | null>(null);
  const [micInitialized, setMicInitialized] = useState(false);

  const connected = connectionState === ConnectionState.Connected;

  const auth = useAuthProvider();
  const apiDeps = useMemo(() => ({ api, auth }), [auth]);

  // Whoever is presenting, and — when that is us — what kind of surface it is.
  // Only a whole monitor can be driven remotely, because a window is captured
  // at an offset the other side cannot know.
  const screenTrack = trackRefs.find((t) => t.source === Track.Source.ScreenShare);
  const sharerIdentity = screenTrack?.participant.identity;
  const shareSurface = isScreenShareEnabled
    ? localParticipant
        .getTrackPublication(Track.Source.ScreenShare)
        ?.track?.mediaStreamTrack.getSettings().displaySurface
    : undefined;

  const remoteControl = useRemoteControl({
    localIdentity: localParticipant.identity,
    isSharing: isScreenShareEnabled,
    shareSurface,
    sharerIdentity,
  });

  const {
    backgroundId,
    setBackground,
    raisedHands,
    handRaised,
    toggleHand,
    reactions,
    sendReaction,
  } = useHuddleSignals(localParticipant.identity);
  const background = getHuddleBackground(backgroundId);

  // Auto-enable mic on first connect — if permission denied, join muted
  useEffect(() => {
    if (!connected || micInitialized) return;
    setMicInitialized(true);
    localParticipant.setMicrophoneEnabled(true).catch((err) => {
      console.warn("Microphone unavailable, joining muted:", err);
    });

    // Started from the composer's camera button, so open with video on.
    const wantsVideo = new URLSearchParams(window.location.search).get("video") === "1";
    if (wantsVideo) {
      localParticipant.setCameraEnabled(true).catch((err) => {
        console.warn("Camera unavailable, joining without video:", err);
      });
    }
  }, [connected, micInitialized, localParticipant]);

  const handleLeave = useCallback(() => {
    room.disconnect();
    notifyHuddleLeave(apiDeps);
    onLeave();
  }, [room, apiDeps, onLeave]);

  const toggleMute = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      const alert = classifyMediaError(err, "microphone");
      if (alert) setPermissionAlert(alert);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCamera = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      const alert = classifyMediaError(err, "camera");
      if (alert) setPermissionAlert(alert);
    }
  }, [localParticipant, isCameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenShareEnabled) {
      try {
        await localParticipant.setScreenShareEnabled(false);
      } catch (err) {
        Sentry.captureException(err);
        console.error("Failed to stop screen share:", err);
      }
    } else {
      try {
        await localParticipant.setScreenShareEnabled(true);
      } catch (err) {
        const alert = classifyMediaError(err, "screen");
        if (alert) setPermissionAlert(alert);
      }
    }
  }, [localParticipant, isScreenShareEnabled]);

  const switchDevice = useCallback(
    async (kind: MediaDeviceKind, deviceId: string) => {
      try {
        await room.switchActiveDevice(kind, deviceId);
      } catch {
        setPermissionAlert({
          title: "Could not switch device",
          description: "The selected device is unavailable. Try a different one.",
        });
      }
    },
    [room],
  );

  // beforeunload cleanup
  useEffect(() => {
    const handler = () => {
      room.disconnect();
      notifyHuddleLeave(apiDeps);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [room, apiDeps]);

  // Build participant list for VideoGrid
  const participants = useMemo(() => {
    const entries = [];
    if (connected) {
      entries.push({
        participant: toHuddleParticipant(
          localParticipant,
          localIsSpeaking,
          !!raisedHands[localParticipant.identity],
          reactions[localParticipant.identity],
        ),
        isLocal: true,
      });
    }
    // A reconnect can briefly leave the previous session listed as a remote
    // with our own identity; rendering it twice breaks the grid keys.
    const seen = new Set(entries.map((e) => e.participant.identity));
    for (const rp of remoteParticipants) {
      if (seen.has(rp.identity)) continue;
      seen.add(rp.identity);
      entries.push({
        participant: toHuddleParticipant(
          rp,
          rp.isSpeaking,
          !!raisedHands[rp.identity],
          reactions[rp.identity],
        ),
        isLocal: false,
      });
    }
    return entries;
  }, [connected, localParticipant, localIsSpeaking, remoteParticipants, raisedHands, reactions]);

  const participantCount = participants.length;

  const nameFor = useCallback(
    (identity: string) =>
      participants.find((p) => p.participant.identity === identity)?.participant.name ?? identity,
    [participants],
  );

  return (
    <div
      className={`flex flex-col ${shellHeight} text-white relative`}
      style={{ background: background.css }}
      data-testid="huddle-shell"
      data-background={backgroundId}
    >
      {/* Permission alert overlay */}
      {permissionAlert && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl" data-testid="permission-alert">
            <h3 className="text-base font-semibold mb-2">{permissionAlert.title}</h3>
            <p className="text-sm text-white/60 mb-5">{permissionAlert.description}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPermissionAlert(null)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-medium border-none cursor-pointer"
                data-testid="permission-alert-ok"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header badge */}
      <div className="shrink-0 px-4 py-2">
        <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/10 rounded-full px-3 py-1.5 border border-white/10" data-testid="huddle-badge">
          <Radio className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">{channelName}</span>
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          {connected && (
            <span className="text-xs text-white/50 ml-1">
              {participantCount} participant{participantCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <RemoteControlPrompt control={remoteControl} nameFor={nameFor} />

      {/* Video grid */}
      <div className="flex-1 min-h-0">
        {connected ? (
          <RemoteControlContext.Provider value={remoteControl}>
            <VideoGrid participants={participants} trackRefs={trackRefs} />
          </RemoteControlContext.Provider>
        ) : (
          <div className="flex items-center justify-center h-full text-white/40 text-sm">
            Connecting...
          </div>
        )}
      </div>

      <HuddleControlBar
        compact={compact}
        isMuted={!isMicrophoneEnabled}
        onToggleMute={toggleMute}
        isCameraEnabled={isCameraEnabled}
        onToggleCamera={toggleCamera}
        isScreenShareEnabled={isScreenShareEnabled}
        onToggleScreenShare={toggleScreenShare}
        handRaised={handRaised}
        onToggleHand={toggleHand}
        onReaction={sendReaction}
        backgroundId={backgroundId}
        onSelectBackground={setBackground}
        onSelectAudioInput={(id) => switchDevice("audioinput", id)}
        onSelectAudioOutput={(id) => switchDevice("audiooutput", id)}
        onSelectVideoInput={(id) => switchDevice("videoinput", id)}
        inviteLink={inviteLink}
        onLeave={handleLeave}
      />
    </div>
  );
}
