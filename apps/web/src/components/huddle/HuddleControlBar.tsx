import { useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  SmilePlus,
  Image as ImageIcon,
  Ellipsis,
  PhoneOff,
  UserPlus,
  SlidersHorizontal,
  ChevronUp,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
} from "../ui";
import { HUDDLE_BACKGROUNDS } from "./huddle-backgrounds";
import { useMediaDevices, deviceLabel } from "./use-media-devices";

/** Quick reactions, matching the set Slack puts behind its emoji button. */
export const HUDDLE_REACTIONS = ["👍", "🎉", "❤️", "😂", "😮", "👏", "🙌", "🔥"];

// The shared menu chrome is light-themed; the huddle is not, so these have to
// win over the base classes rather than just sit alongside them.
const MENU_CLASS = "bg-slate-800! border-white/10! text-white! shadow-2xl";
const ITEM_CLASS = "data-[highlighted]:bg-white/10! flex items-center gap-2";

export interface HuddleControlBarProps {
  /** Trim to the essentials — the docked panel is too narrow for the full bar. */
  compact?: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  isCameraEnabled: boolean;
  onToggleCamera: () => void;
  isScreenShareEnabled: boolean;
  onToggleScreenShare: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  onReaction: (emoji: string) => void;
  backgroundId: string;
  onSelectBackground: (id: string) => void;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  /** Shareable huddle URL; the invite button is hidden when there isn't one. */
  inviteLink?: string;
  onLeave: () => void;
}

function BarButton({
  label,
  active,
  danger,
  onClick,
  testId,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        data-testid={testId}
        className={clsx(
          "w-9 h-9 flex items-center justify-center rounded-full border-none cursor-pointer transition-colors",
          danger
            ? "bg-red-500/85 hover:bg-red-500 text-white"
            : active
              ? "bg-white text-slate-900 hover:bg-white/90"
              : "bg-white/10 hover:bg-white/20 text-white",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** A toggle with a chevron that opens the matching device list, like Slack's. */
function SplitButton({
  label,
  active,
  onToggle,
  testId,
  menuTestId,
  icon,
  menu,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  testId: string;
  menuTestId: string;
  icon: ReactNode;
  menu: ReactNode;
}) {
  return (
    <div className="flex items-center rounded-full overflow-hidden bg-white/10">
      <Tooltip content={label}>
        <button
          type="button"
          aria-label={label}
          onClick={onToggle}
          data-testid={testId}
          className={clsx(
            "w-9 h-9 flex items-center justify-center border-none cursor-pointer transition-colors",
            active
              ? "bg-red-500/85 hover:bg-red-500 text-white"
              : "bg-transparent hover:bg-white/15 text-white",
          )}
        >
          {icon}
        </button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={label + " options"}
            data-testid={menuTestId}
            className="w-5 h-9 flex items-center justify-center bg-transparent hover:bg-white/15 text-white/70 border-none cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className={MENU_CLASS}>
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DeviceList({
  heading,
  devices,
  fallback,
  onSelect,
}: {
  heading: string;
  devices: MediaDeviceInfo[];
  fallback: string;
  onSelect: (deviceId: string) => void;
}) {
  if (devices.length === 0) return null;
  return (
    <>
      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-white/40 font-semibold">
        {heading}
      </div>
      {/* Fake and virtual devices can report the same (or an empty) id. */}
      {devices.map((device, index) => (
        <DropdownMenuItem
          key={device.deviceId + ":" + index}
          className={ITEM_CLASS}
          onSelect={() => onSelect(device.deviceId)}
        >
          <span className="truncate">{deviceLabel(device, fallback)}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

function BackgroundMenu({
  backgroundId,
  onSelectBackground,
}: {
  backgroundId: string;
  onSelectBackground: (id: string) => void;
}) {
  return (
    <div className="p-3 w-[264px]" data-testid="huddle-background-menu">
      <div className="text-xs font-semibold mb-2 text-white/70">Huddle background</div>
      <div className="grid grid-cols-4 gap-2">
        {HUDDLE_BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            type="button"
            title={bg.name}
            aria-label={bg.name}
            data-testid={"huddle-background-" + bg.id}
            onClick={() => onSelectBackground(bg.id)}
            className={clsx(
              "relative h-12 rounded-md cursor-pointer transition-shadow",
              bg.id === backgroundId
                ? "ring-2 ring-white shadow-lg"
                : "ring-1 ring-white/15 hover:ring-white/40",
            )}
            style={{ background: bg.css }}
          >
            {bg.id === backgroundId && (
              <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
            )}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-white/40 mt-2">Everyone in the huddle sees your pick.</p>
    </div>
  );
}

function ReactionMenu({ onReaction }: { onReaction: (emoji: string) => void }) {
  return (
    <div className="flex items-center gap-1 p-2" data-testid="huddle-reaction-menu">
      {HUDDLE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={"React " + emoji}
          data-testid={"huddle-reaction-" + emoji}
          onClick={() => onReaction(emoji)}
          className="w-8 h-8 text-lg leading-none rounded-full bg-transparent hover:bg-white/15 border-none cursor-pointer"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function HuddleControlBar({
  compact = false,
  isMuted,
  onToggleMute,
  isCameraEnabled,
  onToggleCamera,
  isScreenShareEnabled,
  onToggleScreenShare,
  handRaised,
  onToggleHand,
  onReaction,
  backgroundId,
  onSelectBackground,
  onSelectAudioInput,
  onSelectAudioOutput,
  onSelectVideoInput,
  inviteLink,
  onLeave,
}: HuddleControlBarProps) {
  const { audioInputs, audioOutputs, videoInputs } = useMediaDevices();
  const [copied, setCopied] = useState(false);
  // Picking a swatch or an emoji should dismiss its menu the way choosing a
  // normal menu item does, so these stay controlled.
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const pickBackground = (id: string) => {
    onSelectBackground(id);
    setBackgroundOpen(false);
    setMoreOpen(false);
  };

  const pickReaction = (emoji: string) => {
    onReaction(emoji);
    setReactionsOpen(false);
    setMoreOpen(false);
  };

  const copyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard
      ?.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard access can be denied; nothing useful to say about it.
      });
  };

  const audioMenu = (
    <>
      <DeviceList
        heading="Microphone"
        devices={audioInputs}
        fallback="Microphone"
        onSelect={onSelectAudioInput}
      />
      <DeviceList
        heading="Speaker"
        devices={audioOutputs}
        fallback="Speaker"
        onSelect={onSelectAudioOutput}
      />
      {audioInputs.length === 0 && audioOutputs.length === 0 && (
        <div className="px-4 py-3 text-xs text-white/50">No audio devices found</div>
      )}
    </>
  );

  const videoMenu = (
    <>
      <DeviceList
        heading="Camera"
        devices={videoInputs}
        fallback="Camera"
        onSelect={onSelectVideoInput}
      />
      {videoInputs.length === 0 && (
        <div className="px-4 py-3 text-xs text-white/50">No cameras found</div>
      )}
    </>
  );

  const overflowMenu = (
    <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More options"
          data-testid="huddle-more"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer"
        >
          <Ellipsis className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className={MENU_CLASS}>
        {compact && (
          <>
            <DropdownMenuItem className={ITEM_CLASS} onSelect={onToggleHand}>
              <Hand className="w-4 h-4" />
              {handRaised ? "Lower hand" : "Raise hand"}
            </DropdownMenuItem>
            <ReactionMenu onReaction={pickReaction} />
            <BackgroundMenu backgroundId={backgroundId} onSelectBackground={pickBackground} />
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}
        {inviteLink && (
          <DropdownMenuItem className={ITEM_CLASS} onSelect={copyInvite} data-testid="huddle-invite-item">
            <UserPlus className="w-4 h-4" />
            Copy huddle invite link
          </DropdownMenuItem>
        )}
        {audioMenu}
        {videoMenu}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const micButton = (
    <SplitButton
      label={isMuted ? "Unmute" : "Mute"}
      active={isMuted}
      onToggle={onToggleMute}
      testId="huddle-mute-toggle"
      menuTestId="huddle-mic-menu"
      icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      menu={audioMenu}
    />
  );

  const cameraButton = (
    <SplitButton
      label={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
      active={!isCameraEnabled}
      onToggle={onToggleCamera}
      testId="huddle-camera-toggle"
      menuTestId="huddle-camera-menu"
      icon={isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      menu={videoMenu}
    />
  );

  const screenShareButton = (
    <BarButton
      label={isScreenShareEnabled ? "Stop sharing" : "Share screen"}
      active={isScreenShareEnabled}
      onClick={onToggleScreenShare}
      testId="huddle-screenshare-toggle"
    >
      <MonitorUp className="w-5 h-5" />
    </BarButton>
  );

  if (compact) {
    return (
      <div
        className="shrink-0 flex items-center justify-center gap-1.5 px-2 pb-2"
        data-testid="huddle-control-bar"
      >
        {micButton}
        {cameraButton}
        {screenShareButton}
        {overflowMenu}
        <BarButton label="Leave huddle" danger onClick={onLeave} testId="huddle-leave">
          <PhoneOff className="w-5 h-5" />
        </BarButton>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-3 pt-1"
      data-testid="huddle-control-bar"
    >
      {/* Left cluster: settings and invites */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Audio and video settings"
              data-testid="huddle-audio-settings"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className={MENU_CLASS}>
            {audioMenu}
            {videoMenu}
          </DropdownMenuContent>
        </DropdownMenu>

        {inviteLink && (
          <BarButton
            label={copied ? "Link copied" : "Copy invite link"}
            onClick={copyInvite}
            testId="huddle-invite"
          >
            {copied ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </BarButton>
        )}
      </div>

      {/* Centre cluster: the call controls */}
      <div className="flex items-center gap-1.5">
        {micButton}
        {cameraButton}
        {screenShareButton}

        <BarButton
          label={handRaised ? "Lower hand" : "Raise hand"}
          active={handRaised}
          onClick={onToggleHand}
          testId="huddle-hand-toggle"
        >
          <Hand className="w-5 h-5" />
        </BarButton>

        <DropdownMenu open={reactionsOpen} onOpenChange={setReactionsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="React"
              data-testid="huddle-reactions"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer"
            >
              <SmilePlus className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className={MENU_CLASS}>
            <ReactionMenu onReaction={pickReaction} />
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={backgroundOpen} onOpenChange={setBackgroundOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Change background"
              data-testid="huddle-background"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className={MENU_CLASS}>
            <BackgroundMenu backgroundId={backgroundId} onSelectBackground={pickBackground} />
          </DropdownMenuContent>
        </DropdownMenu>

        {overflowMenu}
      </div>

      {/* Right cluster: leaving */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onLeave}
          data-testid="huddle-leave"
          className="px-5 h-9 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-semibold border-none cursor-pointer transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
