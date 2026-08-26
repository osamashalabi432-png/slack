import { VolumeX, Hand } from "lucide-react";
import { VideoTrack, type TrackReferenceOrPlaceholder, isTrackReference } from "@livekit/components-react";

export interface HuddleParticipant {
  identity: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  /** Set while this person has their hand up. */
  handRaised?: boolean;
  /** Their most recent reaction, cleared a few seconds after it arrives. */
  reaction?: string;
}

interface VideoTileProps {
  participant: HuddleParticipant;
  trackRef?: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  /** Screen shares letterbox; camera tiles fill. */
  objectFit?: "cover" | "contain";
}

export function VideoTile({ participant, trackRef, isLocal, objectFit = "cover" }: VideoTileProps) {
  const hasVideo = trackRef && isTrackReference(trackRef);
  const initials = participant.name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative w-full h-full min-h-0 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur border border-white/10 flex items-center justify-center ${
        participant.isSpeaking
          ? "ring-2 ring-blue-400/70 shadow-[0_0_15px_rgba(96,165,250,0.3)]"
          : ""
      }`}
      data-testid={`video-tile-${participant.identity}`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={objectFit === "contain" ? "w-full h-full object-contain" : "w-full h-full object-cover"}
          muted={isLocal}
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-2xl text-white font-semibold shadow-lg">
          {initials}
        </div>
      )}

      {participant.handRaised && (
        <div
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow-lg"
          data-testid={`hand-raised-${participant.identity}`}
          title={`${participant.name} raised their hand`}
        >
          <Hand className="w-4 h-4" />
        </div>
      )}

      {participant.reaction && (
        <div
          className="absolute top-2 right-2 text-2xl drop-shadow-lg"
          data-testid={`reaction-${participant.identity}`}
        >
          {participant.reaction}
        </div>
      )}

      {/* Name overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 backdrop-blur-md bg-white/10 rounded-full px-2 py-0.5 border border-white/10">
        {isLocal && <span className="text-white/50 text-xs">(You)</span>}
        <span className="truncate max-w-[120px] text-xs text-white">{participant.name}</span>
        {participant.isMuted && (
          <VolumeX className="w-3 h-3 text-red-400 shrink-0" />
        )}
      </div>
    </div>
  );
}
