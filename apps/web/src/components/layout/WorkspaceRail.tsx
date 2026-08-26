import { useState } from "react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import {
  Home,
  MessageSquare,
  Bell,
  FileText,
  MoreHorizontal,
  Plus,
  Bookmark,
  Clock,
  Shield,
  LayoutGrid,
  UserPlus,
  Settings,
} from "lucide-react";
import { Tooltip } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { CustomUserButton } from "../user/CustomUserButton";
import { useGalleryMode } from "../../gallery/gallery-context";
import type { WorkspaceInfo } from "../../state/chat-store";

export type RailView =
  | "channel"
  | "unreads"
  | "saved"
  | "outbox"
  | "files"
  | "compose"
  | "directory"
  | "page";

interface RailButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  testId?: string;
  onClick?: () => void;
}

/** A single icon-over-label entry in the workspace rail. */
function RailButton({ icon, label, active, badge, testId, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full flex flex-col items-center gap-0.5 py-1.5 bg-transparent border-none cursor-pointer group"
    >
      <span
        className={clsx(
          "relative w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-colors",
          active
            ? "bg-rail-active text-sidebar-text"
            : "text-sidebar-muted group-hover:bg-rail-hover group-hover:text-sidebar-text",
        )}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span
        className={clsx(
          "text-[11px] leading-tight font-medium transition-colors",
          active ? "text-sidebar-text" : "text-sidebar-muted group-hover:text-sidebar-text",
        )}
      >
        {label}
      </span>
    </button>
  );
}

interface WorkspaceRailProps {
  workspaces: WorkspaceInfo[];
  workspaceSlug: string;
  activeView: RailView;
  unreadTotal: number;
  canManage: boolean;
  onSelectHome: () => void;
  onSelectComposeView: () => void;
  onSelectUnreadsView: () => void;
  onSelectFilesView: () => void;
  onSelectSavedView: () => void;
  onSelectOutboxView: () => void;
  onOpenInvite: () => void;
  onOpenWorkspaceSettings: () => void;
}

/**
 * Slack-style far-left rail: workspace switcher on top, primary navigation
 * in the middle, compose + account controls pinned to the bottom.
 */
export function WorkspaceRail({
  workspaces,
  workspaceSlug,
  activeView,
  unreadTotal,
  canManage,
  onSelectHome,
  onSelectComposeView,
  onSelectUnreadsView,
  onSelectFilesView,
  onSelectSavedView,
  onSelectOutboxView,
  onOpenInvite,
  onOpenWorkspaceSettings,
}: WorkspaceRailProps) {
  const navigate = useNavigate();
  const isGallery = useGalleryMode();
  const [moreOpen, setMoreOpen] = useState(false);

  const currentWorkspace = workspaces.find((ws) => ws.slug === workspaceSlug);
  const workspaceName = currentWorkspace?.name ?? workspaceSlug;
  const workspaceInitials = workspaceName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      data-testid="workspace-rail"
      className="w-[68px] shrink-0 bg-rail flex flex-col items-center pt-2 pb-2 select-none"
    >
      {/* Workspace switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="rail-workspace-button"
            aria-label={`${workspaceName} workspace menu`}
            className="w-9 h-9 rounded-lg bg-white/90 text-[#3f0e40] text-[13px] font-black flex items-center justify-center cursor-pointer border-none hover:ring-2 hover:ring-white/40 transition-all shrink-0"
          >
            {workspaceInitials || "W"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="min-w-[220px]">
          <div className="px-2 py-1.5 text-[13px] font-semibold text-text-primary truncate">
            {workspaceName}
          </div>
          <DropdownMenuSeparator />
          {workspaces
            .filter((ws) => ws.slug !== workspaceSlug)
            .map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => navigate(`/w/${ws.slug}`)}
                className="flex items-center gap-2"
              >
                <span className="w-5 h-5 rounded bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {ws.name.charAt(0).toUpperCase()}
                </span>
                {ws.name}
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onSelect={() => navigate("/")} className="flex items-center gap-2 text-[13px]">
            <LayoutGrid className="w-4 h-4" />
            All workspaces
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenInvite} className="flex items-center gap-2 text-[13px]">
            <UserPlus className="w-4 h-4" />
            Invite people
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenWorkspaceSettings} className="flex items-center gap-2 text-[13px]">
            <Settings className="w-4 h-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Primary navigation */}
      <nav className="w-full mt-3 px-1 flex flex-col">
        <RailButton
          icon={<Home className="w-[19px] h-[19px]" />}
          label="Home"
          active={activeView === "channel"}
          testId="home-view-link"
          onClick={onSelectHome}
        />
        <RailButton
          icon={<MessageSquare className="w-[19px] h-[19px]" />}
          label="DMs"
          active={activeView === "compose"}
          testId="dms-view-link"
          onClick={onSelectComposeView}
        />
        <RailButton
          icon={<Bell className="w-[19px] h-[19px]" />}
          label="Activity"
          active={activeView === "unreads"}
          badge={unreadTotal}
          testId="unreads-view-link"
          onClick={onSelectUnreadsView}
        />
        <RailButton
          icon={<FileText className="w-[19px] h-[19px]" />}
          label="Files"
          active={activeView === "files"}
          testId="files-view-link"
          onClick={onSelectFilesView}
        />

        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="rail-more-button"
              className="w-full flex flex-col items-center gap-0.5 py-1.5 bg-transparent border-none cursor-pointer group"
            >
              <span
                className={clsx(
                  "w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-colors",
                  activeView === "saved" || activeView === "outbox"
                    ? "bg-rail-active text-sidebar-text"
                    : "text-sidebar-muted group-hover:bg-rail-hover group-hover:text-sidebar-text",
                )}
              >
                <MoreHorizontal className="w-[19px] h-[19px]" />
              </span>
              <span className="text-[11px] leading-tight font-medium text-sidebar-muted group-hover:text-sidebar-text">
                More
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="min-w-[200px]">
            <DropdownMenuItem
              data-testid="saved-view-link"
              onSelect={onSelectSavedView}
              className="flex items-center gap-2 text-[13px]"
            >
              <Bookmark className="w-4 h-4" />
              Later
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="outbox-view-link"
              onSelect={onSelectOutboxView}
              className="flex items-center gap-2 text-[13px]"
            >
              <Clock className="w-4 h-4" />
              Drafts &amp; sent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {canManage && (
          <RailButton
            icon={<Shield className="w-[19px] h-[19px]" />}
            label="Admin"
            testId="admin-rail-link"
            onClick={onOpenWorkspaceSettings}
          />
        )}
      </nav>

      <div className="flex-1" />

      {/* Compose + account */}
      <Tooltip content="New message" side="right">
        <button
          type="button"
          data-testid="rail-compose-button"
          onClick={onSelectComposeView}
          aria-label="New message"
          className="w-9 h-9 rounded-full bg-white/10 text-sidebar-text flex items-center justify-center border-none cursor-pointer hover:bg-white/20 transition-colors mb-3"
        >
          <Plus className="w-5 h-5" />
        </button>
      </Tooltip>

      {!isGallery && (
        <div className="[&_button]:hover:bg-rail-hover">
          <CustomUserButton />
        </div>
      )}
    </div>
  );
}
