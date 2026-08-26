import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MousePointer2, Hand, X } from "lucide-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { VideoTile, type HuddleParticipant } from "./VideoTile";
import { useRemoteControlContext } from "./remote-control-context";
import type { ControlEvent } from "../../lib/remote-control";

interface ScreenSharePaneProps {
  participant: HuddleParticipant;
  trackRef?: TrackReferenceOrPlaceholder;
  isLocal: boolean;
}

const BUTTONS: Record<number, "left" | "right" | "middle"> = {
  0: "left",
  1: "middle",
  2: "right",
};

/**
 * Where the picture actually sits inside its box. The video is letterboxed
 * (object-contain) so the shared screen is never cropped, which also means the
 * element's own rectangle is not the picture's rectangle.
 */
function pictureRect(video: HTMLVideoElement): DOMRect | null {
  const rect = video.getBoundingClientRect();
  const { videoWidth: vw, videoHeight: vh } = video;
  if (!vw || !vh || !rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / vw, rect.height / vh);
  const width = vw * scale;
  const height = vh * scale;
  return new DOMRect(rect.left + (rect.width - width) / 2, rect.top + (rect.height - height) / 2, width, height);
}

export function ScreenSharePane({ participant, trackRef, isLocal }: ScreenSharePaneProps) {
  const control = useRemoteControlContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);

  const active = control?.status === "active" && !isLocal;

  // Pointer moves are coalesced to one per frame; without this a fast drag
  // floods the data channel with hundreds of near-identical positions.
  const pendingMove = useRef<ControlEvent | null>(null);
  const frame = useRef<number | null>(null);
  const sendInput = control?.sendInput;

  const flush = useCallback(() => {
    frame.current = null;
    const move = pendingMove.current;
    pendingMove.current = null;
    if (move) sendInput?.([move]);
  }, [sendInput]);

  const queueMove = useCallback(
    (event: ControlEvent) => {
      pendingMove.current = event;
      frame.current ??= requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const video = containerRef.current?.querySelector("video");
    if (!video) return null;
    const rect = pictureRect(video);
    if (!rect) return null;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  // Keyboard goes to the whole window while controlling, so the remote machine
  // still receives shortcuts that a focused element would otherwise swallow.
  useEffect(() => {
    if (!active || !sendInput) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        control?.release();
        return;
      }
      e.preventDefault();
      sendInput([{ kind: "key", key: e.key, down: e.type === "keydown" }]);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [active, sendInput, control]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0">
      <VideoTile participant={participant} trackRef={trackRef} isLocal={isLocal} objectFit="contain" />

      {active && (
        <div
          data-testid="remote-control-surface"
          className="absolute inset-0 z-10 cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerMove={(e) => {
            const point = toNormalized(e.clientX, e.clientY);
            if (point) queueMove({ kind: "move", ...point });
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            const point = toNormalized(e.clientX, e.clientY);
            const events: ControlEvent[] = [];
            if (point) events.push({ kind: "move", ...point });
            events.push({ kind: "button", button: BUTTONS[e.button] ?? "left", down: true });
            sendInput?.(events);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            sendInput?.([{ kind: "button", button: BUTTONS[e.button] ?? "left", down: false }]);
          }}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => {
            // Browsers report pixels; enigo counts lines.
            sendInput?.([
              { kind: "scroll", dx: Math.trunc(e.deltaX / 100), dy: Math.trunc(e.deltaY / 100) },
            ]);
          }}
        />
      )}

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {active ? (
          <button
            type="button"
            onClick={() => control?.release()}
            data-testid="remote-control-release"
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-semibold border-none cursor-pointer"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            You have control — release (Esc)
          </button>
        ) : control?.status === "requesting" ? (
          <span
            data-testid="remote-control-pending"
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/15 text-white text-xs"
          >
            <Hand className="w-3.5 h-3.5" />
            Waiting for {participant.name}…
          </span>
        ) : (
          !isLocal &&
          control && (
            <div
              className="relative flex items-center gap-2"
              onMouseEnter={() => setHint(true)}
              onMouseLeave={() => setHint(false)}
            >
              {hint && control.unavailableReason && (
                <span className="px-2 py-1 rounded bg-slate-900/90 text-white/80 text-[11px] whitespace-nowrap">
                  {control.unavailableReason}
                </span>
              )}
              {control.status === "denied" && (
                <span
                  data-testid="remote-control-denied"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900/90 text-amber-300 text-[11px]"
                >
                  <X className="w-3 h-3" />
                  Request declined
                </span>
              )}
              <button
                type="button"
                disabled={!control.canRequest}
                onClick={() => control.requestControl()}
                data-testid="remote-control-request"
                className={clsx(
                  "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border-none",
                  control.canRequest
                    ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                    : "bg-white/10 text-white/40 cursor-not-allowed",
                )}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                Request control
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
