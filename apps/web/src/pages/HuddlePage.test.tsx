import { describe, test, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "../test-utils";
import { fireEvent } from "@testing-library/react";
import { ConnectionState, Track } from "livekit-client";

// --- Mocks (must be before component import) ---

// Prevent @stripe/stripe-js side-effect script injection in happy-dom
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: async () => null,
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ channelId: "ch-1" }),
}));

const mockUser = {
  id: "user-1",
  displayName: "Test User",
  getAuthJson: async () => ({ accessToken: "tok" }),
};
vi.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUser,
}));

vi.mock("../lib/api-client", () => ({
  authorizedHeaders: async () => ({ Authorization: "Bearer tok" }),
  useAuthProvider: () => ({ requireAccessToken: async () => "tok" }),
}));

vi.mock("../api", () => ({
  api: {},
}));

vi.mock("../env", () => ({
  env: { VITE_API_URL: "http://localhost:3001" },
}));

const mockNotifyHuddleLeave = vi.fn(() => Promise.resolve({ ended: false }));
vi.mock("@openslaq/client-core", async () => {
  const actual = await vi.importActual<typeof import("@openslaq/client-core")>("@openslaq/client-core");
  return { ...actual, notifyHuddleLeave: () => mockNotifyHuddleLeave() };
});

// LiveKit mocks
let mockConnectionState = ConnectionState.Connected;
const mockSetMicrophoneEnabled = vi.fn(async () => {});
const mockSetCameraEnabled = vi.fn(async () => {});
const mockSetScreenShareEnabled = vi.fn(async () => {});
const mockRoomDisconnect = vi.fn(async () => {});
const mockSwitchActiveDevice = vi.fn(async () => {});

const mockLocalParticipant = {
  identity: "user-1",
  name: "Test User",
  isSpeaking: false,
  trackPublications: new Map([
    ["mic", { source: Track.Source.Microphone, isMuted: false }],
  ]),
  setMicrophoneEnabled: mockSetMicrophoneEnabled,
  setCameraEnabled: mockSetCameraEnabled,
  setScreenShareEnabled: mockSetScreenShareEnabled,
};

const mockRoom = {
  disconnect: mockRoomDisconnect,
  switchActiveDevice: mockSwitchActiveDevice,
  on: vi.fn(),
  off: vi.fn(),
};

// Captures whatever the huddle broadcasts to the other participants.
const mockDataSend = vi.fn();
function sentSignals() {
  return mockDataSend.mock.calls.map((call) => JSON.parse(new TextDecoder().decode(call[0] as Uint8Array)));
}

let mockIsMicrophoneEnabled = true;
let mockIsCameraEnabled = false;
let mockIsScreenShareEnabled = false;

vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children, onError }: { children: React.ReactNode; onError?: (err: Error) => void; [k: string]: unknown }) => {
    // Store onError so tests can trigger it
    (globalThis as unknown as Record<string, unknown>).__lkOnError = onError;
    return <>{children}</>;
  },
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
  useLocalParticipant: () => ({
    localParticipant: mockLocalParticipant,
    isMicrophoneEnabled: mockIsMicrophoneEnabled,
    isCameraEnabled: mockIsCameraEnabled,
    isScreenShareEnabled: mockIsScreenShareEnabled,
  }),
  useRemoteParticipants: () => [],
  useConnectionState: () => mockConnectionState,
  useRoomContext: () => mockRoom,
  useTracks: () => [],
  useIsSpeaking: () => false,
  useDataChannel: () => ({ send: mockDataSend }),
}));

// Menus render inline so their contents are queryable without Radix portals.
vi.mock("../components/ui", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <div onClick={onSelect}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

interface MockGridParticipant {
  participant: { identity: string; isMuted?: boolean; handRaised?: boolean; reaction?: string };
  isLocal: boolean;
}

vi.mock("../components/huddle/VideoGrid", () => ({
  VideoGrid: ({ participants }: { participants: MockGridParticipant[] }) => (
    <div data-testid="video-grid">
      {participants.map((p) => (
        <span
          key={p.participant.identity}
          data-testid={`grid-${p.participant.identity}`}
          data-hand={p.participant.handRaised ? "1" : "0"}
          data-reaction={p.participant.reaction ?? ""}
        />
      ))}
    </div>
  ),
}));

// Mock useHuddleToken
let mockToken: string | null = "lk-token";
let mockWsUrl: string | null = "ws://localhost";
let mockTokenError: string | null = null;

vi.mock("../hooks/chat/useHuddleToken", () => ({
  useHuddleToken: () => ({
    token: mockToken,
    wsUrl: mockWsUrl,
    error: mockTokenError,
    isLoading: false,
  }),
}));

import { HuddlePage } from "./HuddlePage";

// --- Tests ---

describe("HuddlePage", () => {
  beforeEach(() => {
    mockConnectionState = ConnectionState.Connected;
    mockToken = "lk-token";
    mockWsUrl = "ws://localhost";
    mockTokenError = null;
    mockIsMicrophoneEnabled = true;
    mockIsCameraEnabled = false;
    mockIsScreenShareEnabled = false;
    mockSetMicrophoneEnabled.mockClear();
    mockSetCameraEnabled.mockClear();
    mockSetScreenShareEnabled.mockClear();
    mockRoomDisconnect.mockClear();
    mockSwitchActiveDevice.mockClear();
    mockNotifyHuddleLeave.mockClear();
    mockDataSend.mockClear();
  });

  afterEach(cleanup);

  test("renders RoomAudioRenderer (fixes remote audio bug)", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });
    expect(screen.getByTestId("room-audio-renderer")).toBeTruthy();
  });

  test("renders connecting state when not connected", async () => {
    mockConnectionState = ConnectionState.Connecting;

    await act(async () => {
      render(<HuddlePage />);
    });

    expect(screen.getByText("Connecting...")).toBeTruthy();
  });

  test("renders video grid when connected", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    expect(screen.getByTestId("video-grid")).toBeTruthy();
  });

  test("token error shows error text", async () => {
    mockTokenError = "Room not found";

    await act(async () => {
      render(<HuddlePage />);
    });

    expect(screen.getByText("Room not found")).toBeTruthy();
  });

  test("badge shows channel name", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    const badge = screen.getByTestId("huddle-badge");
    expect(badge.textContent).toContain("Huddle");
  });

  test("mute toggle calls setMicrophoneEnabled", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    const muteBtn = screen.getByTestId("huddle-mute-toggle");
    await act(async () => {
      fireEvent.click(muteBtn);
    });

    expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  test("camera toggle calls setCameraEnabled", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    const cameraBtn = screen.getByTestId("huddle-camera-toggle");
    await act(async () => {
      fireEvent.click(cameraBtn);
    });

    expect(mockSetCameraEnabled).toHaveBeenCalledWith(true);
  });

  test("screen share toggle calls setScreenShareEnabled", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    const shareBtn = screen.getByTestId("huddle-screenshare-toggle");
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(mockSetScreenShareEnabled).toHaveBeenCalledWith(true);
  });

  test("leave button disconnects and notifies server", async () => {
    const closeSpy = vi.fn();
    window.close = closeSpy;

    await act(async () => {
      render(<HuddlePage />);
    });

    const leaveBtn = screen.getByTestId("huddle-leave");
    await act(async () => {
      fireEvent.click(leaveBtn);
    });

    expect(mockRoomDisconnect).toHaveBeenCalled();
    expect(mockNotifyHuddleLeave).toHaveBeenCalledTimes(1);
  });

  test("participant count updates when connected", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    expect(screen.getByText("1 participant")).toBeTruthy();
  });

  test("camera permission denied shows alert", async () => {
    mockSetCameraEnabled.mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    await act(async () => {
      render(<HuddlePage />);
    });

    const cameraBtn = screen.getByTestId("huddle-camera-toggle");
    await act(async () => {
      fireEvent.click(cameraBtn);
    });

    expect(screen.getByTestId("permission-alert")).toBeTruthy();
    expect(screen.getByText(/camera blocked/i)).toBeTruthy();
  });

  test("permission alert can be dismissed", async () => {
    mockSetCameraEnabled.mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    await act(async () => {
      render(<HuddlePage />);
    });

    const cameraBtn = screen.getByTestId("huddle-camera-toggle");
    await act(async () => {
      fireEvent.click(cameraBtn);
    });

    expect(screen.getByTestId("permission-alert")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("permission-alert-ok"));
    });

    expect(screen.queryByTestId("permission-alert")).toBeNull();
  });

  test("screen share cancel — no alert shown", async () => {
    mockSetScreenShareEnabled.mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    await act(async () => {
      render(<HuddlePage />);
    });

    const shareBtn = screen.getByTestId("huddle-screenshare-toggle");
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // User cancelled the picker — no alert
    expect(screen.queryByTestId("permission-alert")).toBeNull();
  });

  test("mute button shows correct state", async () => {
    mockIsMicrophoneEnabled = false;

    await act(async () => {
      render(<HuddlePage />);
    });

    const muteBtn = screen.getByTestId("huddle-mute-toggle");
    expect(muteBtn.className).toContain("bg-red-500");
  });

  test("camera button shows correct state", async () => {
    mockIsCameraEnabled = false;

    await act(async () => {
      render(<HuddlePage />);
    });

    const cameraBtn = screen.getByTestId("huddle-camera-toggle");
    expect(cameraBtn.className).toContain("bg-red-500");
  });

  test("picking a background repaints the huddle and tells everyone else", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    expect(screen.getByTestId("huddle-shell").dataset.background).toBe("midnight");

    await act(async () => {
      fireEvent.click(screen.getAllByTestId("huddle-background-forest")[0]!);
    });

    const shell = screen.getByTestId("huddle-shell");
    expect(shell.dataset.background).toBe("forest");
    expect(shell.style.background).toContain("linear-gradient");
    expect(sentSignals()).toContainEqual({ t: "bg", id: "forest" });
  });

  test("raising a hand marks the local tile and is broadcast", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("huddle-hand-toggle"));
    });

    expect(screen.getByTestId("grid-user-1").dataset.hand).toBe("1");
    expect(sentSignals()).toContainEqual({ t: "hand", raised: true });

    await act(async () => {
      fireEvent.click(screen.getByTestId("huddle-hand-toggle"));
    });

    expect(screen.getByTestId("grid-user-1").dataset.hand).toBe("0");
    expect(sentSignals()).toContainEqual({ t: "hand", raised: false });
  });

  test("a reaction shows on the sender's own tile straight away", async () => {
    await act(async () => {
      render(<HuddlePage />);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByTestId("huddle-reaction-🎉")[0]!);
    });

    expect(screen.getByTestId("grid-user-1").dataset.reaction).toBe("🎉");
    expect(sentSignals()).toContainEqual({ t: "reaction", emoji: "🎉" });
  });

  test("the invite link points at the standalone huddle route", async () => {
    await act(async () => {
      render(<HuddlePage channelId="ch-9" channelName="general" />);
    });

    const copy = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copy }, configurable: true });

    await act(async () => {
      fireEvent.click(screen.getByTestId("huddle-invite"));
    });

    expect(copy).toHaveBeenCalledWith(expect.stringContaining("/huddle/ch-9?name=general"));
  });

  test("compact mode drops the wide-only controls", async () => {
    await act(async () => {
      render(<HuddlePage inline compact />);
    });

    // Mic, camera, screen share, overflow and leave stay; the rest move into
    // the overflow menu, which this test renders inline.
    expect(screen.getByTestId("huddle-mute-toggle")).toBeTruthy();
    expect(screen.getByTestId("huddle-leave")).toBeTruthy();
    expect(screen.queryByTestId("huddle-hand-toggle")).toBeNull();
    expect(screen.queryByTestId("huddle-audio-settings")).toBeNull();
  });
});
