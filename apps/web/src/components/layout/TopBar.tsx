import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Clock, Search, HelpCircle, PanelLeft, Minus, Square, Copy, X } from "lucide-react";
import { Tooltip } from "../ui/tooltip";
import { isTauri } from "../../lib/tauri";
import { useDesktopWindowChrome } from "../../lib/window-chrome";

interface TopBarProps {
  workspaceName: string;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  onSelectOutboxView: () => void;
}

const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/** Minimise / maximise / close, shown only in the desktop shell. */
function WindowControls() {
  const { maximized } = useDesktopWindowChrome();

  const run = useCallback(async (action: "minimize" | "toggle" | "close") => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    else if (action === "toggle") await win.toggleMaximize();
    else await win.close();
  }, []);

  const base =
    "w-[46px] h-11 flex items-center justify-center border-none bg-transparent cursor-pointer text-sidebar-muted hover:text-sidebar-text transition-colors";

  return (
    <div className="flex items-stretch h-11 -my-2 -mr-2 ml-1 shrink-0">
      <button
        type="button"
        aria-label="Minimize"
        data-testid="window-minimize"
        onClick={() => void run("minimize")}
        className={`${base} hover:bg-white/10`}
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        data-testid="window-maximize"
        onClick={() => void run("toggle")}
        className={`${base} hover:bg-white/10`}
      >
        {maximized ? <Copy className="w-3.5 h-3.5 -scale-x-100" /> : <Square className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Close"
        data-testid="window-close"
        onClick={() => void run("close")}
        className={`${base} hover:bg-[#c42b1c] hover:text-white`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Slack-style global top bar: history controls, global search, help. */
export function TopBar({ workspaceName, onOpenSearch, onToggleSidebar, onSelectOutboxView }: TopBarProps) {
  const navigate = useNavigate();

  return (
    <div
      data-testid="top-bar"
      // With native decorations off, this bar is what the user drags to move
      // the window. Buttons inside still receive their own clicks.
      data-tauri-drag-region
      className="h-11 shrink-0 bg-topbar flex items-center px-2 gap-1 select-none"
    >
      <Tooltip content="Toggle sidebar" side="bottom">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          data-testid="toggle-sidebar-button"
          className="w-7 h-7 flex items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-sidebar-text border-none bg-transparent cursor-pointer transition-colors"
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>

      <div className="flex items-center gap-0.5 ml-1">
        <Tooltip content="Back" side="bottom">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-7 h-7 flex items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-sidebar-text border-none bg-transparent cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <Tooltip content="Forward" side="bottom">
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Go forward"
            className="w-7 h-7 flex items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-sidebar-text border-none bg-transparent cursor-pointer transition-colors"
          >
            <ArrowRight className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <Tooltip content="Drafts & sent" side="bottom">
          <button
            type="button"
            onClick={onSelectOutboxView}
            aria-label="Drafts and sent"
            className="w-7 h-7 flex items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-sidebar-text border-none bg-transparent cursor-pointer transition-colors"
          >
            <Clock className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
      </div>

      {/* Centered search */}
      <div className="flex-1 flex justify-center px-4">
        <button
          type="button"
          onClick={onOpenSearch}
          data-testid="search-trigger"
          className="w-full max-w-[720px] h-[26px] rounded-md bg-topbar-input text-sidebar-muted hover:bg-white/20 transition-colors flex items-center gap-2 px-2 border-none cursor-pointer text-[13px]"
        >
          <Search className="w-[14px] h-[14px] shrink-0" />
          <span className="truncate">Search {workspaceName}</span>
          <span className="ml-auto text-[11px] opacity-70 shrink-0">{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>
      </div>

      <Tooltip content="Help" side="bottom">
        <button
          type="button"
          aria-label="Help"
          onClick={() => window.open("https://docs.openslaq.com", "_blank", "noopener")}
          className="w-7 h-7 flex items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-sidebar-text border-none bg-transparent cursor-pointer transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>

      {isTauri() && <WindowControls />}
    </div>
  );
}
