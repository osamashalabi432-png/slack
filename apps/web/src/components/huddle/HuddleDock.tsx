import { useState } from "react";
import clsx from "clsx";
import { Minus, Maximize2, Minimize2 } from "lucide-react";
import { HuddlePage } from "../../pages/HuddlePage";

interface HuddleDockProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
}

/**
 * Huddles render docked inside the main window, the way Slack does, rather
 * than in a separate webview. Keeping them here avoids a second window that
 * has to re-establish its own session and can be left hanging on screen.
 */
export function HuddleDock({ channelId, channelName, onClose }: HuddleDockProps) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  return (
    <div
      data-testid="huddle-dock"
      className={clsx(
        "fixed z-40 rounded-xl overflow-hidden border border-border-strong shadow-2xl bg-slate-950",
        minimized
          ? "bottom-3 left-[76px] w-[260px] h-[52px]"
          : expanded
            ? // Fills the whole client area, stopping below the window chrome so
              // the title bar controls stay reachable.
              "top-11 left-0 right-0 bottom-0 rounded-none border-0"
            : "bottom-3 left-[76px] w-[340px] h-[420px]",
      )}
    >
      <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-1">
        <button
          type="button"
          aria-label={minimized ? "Expand huddle" : "Minimize huddle"}
          data-testid="huddle-dock-minimize"
          onClick={() => {
            setMinimized((v) => !v);
            setExpanded(false);
          }}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/10 text-white/80 hover:bg-white/20 border-none cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        {!minimized && (
          <button
            type="button"
            aria-label={expanded ? "Restore huddle" : "Expand huddle"}
            data-testid="huddle-dock-expand"
            onClick={() => setExpanded((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded bg-white/10 text-white/80 hover:bg-white/20 border-none cursor-pointer"
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {minimized ? (
        <button
          type="button"
          data-testid="huddle-dock-restore"
          onClick={() => setMinimized(false)}
          className="w-full h-full flex items-center gap-2 px-3 text-left bg-transparent border-none cursor-pointer text-white"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-[13px] font-medium truncate">{channelName}</span>
        </button>
      ) : (
        <HuddlePage
          inline
          compact={!expanded}
          channelId={channelId}
          channelName={channelName}
          onClose={onClose}
        />
      )}
    </div>
  );
}
