import { describe, test, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "../../test-utils";

const mockSend = vi.fn();
let onMessage: ((msg: { from?: { identity: string }; payload: Uint8Array }) => void) | undefined;

const roomHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
const mockRoom = {
  on: (event: string, fn: (...args: unknown[]) => void) => {
    (roomHandlers[event] ??= []).push(fn);
  },
  off: (event: string, fn: (...args: unknown[]) => void) => {
    roomHandlers[event] = (roomHandlers[event] ?? []).filter((f) => f !== fn);
  },
};

vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => mockRoom,
  useDataChannel: (_topic: string, cb: typeof onMessage) => {
    onMessage = cb;
    return { send: mockSend };
  },
}));

const mockSetEnabled = vi.fn((_enabled: boolean) => Promise.resolve());
const mockApply = vi.fn((_events: unknown) => Promise.resolve());
vi.mock("../../lib/remote-control", () => ({
  setRemoteControlEnabled: (v: boolean) => mockSetEnabled(v),
  applyRemoteControl: (events: unknown) => mockApply(events),
  canBeControlled: () => true,
}));

import { useRemoteControl } from "./useRemoteControl";

function deliver(from: string, message: unknown) {
  act(() => {
    onMessage?.({ from: { identity: from }, payload: new TextEncoder().encode(JSON.stringify(message)) });
  });
}

function sent() {
  return mockSend.mock.calls.map((call) => ({
    message: JSON.parse(new TextDecoder().decode(call[0] as Uint8Array)),
    options: call[1] as { destinationIdentities?: string[]; reliable?: boolean },
  }));
}

const AS_SHARER = { localIdentity: "me", isSharing: true, shareSurface: "monitor", sharerIdentity: "me" };
const AS_VIEWER = { localIdentity: "me", isSharing: false, sharerIdentity: "alice" };

type Props = { localIdentity: string; isSharing: boolean; shareSurface?: string; sharerIdentity?: string };

describe("useRemoteControl", () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockSetEnabled.mockClear();
    mockApply.mockClear();
    for (const key of Object.keys(roomHandlers)) delete roomHandlers[key];
  });

  describe("as the person sharing", () => {
    test("a request waits for an answer and only then arms injection", () => {
      const { result } = renderHook(() => useRemoteControl(AS_SHARER));

      deliver("bob", { t: "req" });
      expect(result.current.pendingRequest).toBe("bob");
      expect(mockSetEnabled).not.toHaveBeenCalledWith(true);

      act(() => result.current.approve());

      expect(result.current.controlledBy).toBe("bob");
      expect(result.current.pendingRequest).toBeNull();
      expect(mockSetEnabled).toHaveBeenCalledWith(true);
      expect(sent()).toContainEqual({
        message: { t: "grant" },
        options: { reliable: true, destinationIdentities: ["bob"] },
      });
    });

    test("declining never arms injection", () => {
      const { result } = renderHook(() => useRemoteControl(AS_SHARER));

      deliver("bob", { t: "req" });
      act(() => result.current.deny());

      expect(result.current.pendingRequest).toBeNull();
      expect(result.current.controlledBy).toBeNull();
      expect(mockSetEnabled).not.toHaveBeenCalledWith(true);
      expect(sent().some((s) => s.message.t === "deny")).toBe(true);
    });

    test("revoking disarms injection and tells the controller", () => {
      const { result } = renderHook(() => useRemoteControl(AS_SHARER));
      deliver("bob", { t: "req" });
      act(() => result.current.approve());
      mockSetEnabled.mockClear();

      act(() => result.current.revoke());

      expect(result.current.controlledBy).toBeNull();
      expect(mockSetEnabled).toHaveBeenCalledWith(false);
      expect(sent().some((s) => s.message.t === "revoke")).toBe(true);
    });

    test("input is applied only from the participant who was granted control", () => {
      const { result } = renderHook(() => useRemoteControl(AS_SHARER));
      deliver("bob", { t: "req" });
      act(() => result.current.approve());

      deliver("mallory", { t: "in", events: [{ kind: "move", x: 0.5, y: 0.5 }] });
      expect(mockApply).not.toHaveBeenCalled();

      deliver("bob", { t: "in", events: [{ kind: "move", x: 0.5, y: 0.5 }] });
      expect(mockApply).toHaveBeenCalledWith([{ kind: "move", x: 0.5, y: 0.5 }]);
    });

    test("a request is ignored while someone else already has control", () => {
      const { result } = renderHook(() => useRemoteControl(AS_SHARER));
      deliver("bob", { t: "req" });
      act(() => result.current.approve());

      deliver("mallory", { t: "req" });
      expect(result.current.pendingRequest).toBeNull();
    });

    test("stopping the share ends control", () => {
      const { result, rerender } = renderHook((props: Props) => useRemoteControl(props), {
        initialProps: AS_SHARER as Props,
      });
      deliver("bob", { t: "req" });
      act(() => result.current.approve());
      mockSetEnabled.mockClear();

      rerender({ ...AS_SHARER, isSharing: false, sharerIdentity: undefined });

      expect(result.current.controlledBy).toBeNull();
      expect(mockSetEnabled).toHaveBeenCalledWith(false);
    });

    test("announces the surface so viewers know whether control is possible", () => {
      renderHook(() => useRemoteControl(AS_SHARER));
      expect(sent()).toContainEqual({
        message: { t: "cap", surface: "monitor", desktop: true },
        options: { reliable: true, destinationIdentities: undefined },
      });
    });
  });

  describe("as a viewer", () => {
    test("cannot ask until the sharer says a full screen is on offer", () => {
      const { result } = renderHook(() => useRemoteControl(AS_VIEWER));
      expect(result.current.canRequest).toBe(false);
      expect(result.current.unavailableReason).toMatch(/waiting/i);

      deliver("alice", { t: "cap", surface: "window", desktop: true });
      expect(result.current.canRequest).toBe(false);
      expect(result.current.unavailableReason).toMatch(/full screen/i);

      deliver("alice", { t: "cap", surface: "monitor", desktop: false });
      expect(result.current.unavailableReason).toMatch(/desktop app/i);

      deliver("alice", { t: "cap", surface: "monitor", desktop: true });
      expect(result.current.canRequest).toBe(true);
      expect(result.current.unavailableReason).toBeNull();
    });

    test("goes active on a grant and back to idle when revoked", () => {
      const { result } = renderHook(() => useRemoteControl(AS_VIEWER));
      deliver("alice", { t: "cap", surface: "monitor", desktop: true });

      act(() => result.current.requestControl());
      expect(result.current.status).toBe("requesting");

      deliver("alice", { t: "grant" });
      expect(result.current.status).toBe("active");

      deliver("alice", { t: "revoke" });
      expect(result.current.status).toBe("idle");
    });

    test("a decline is surfaced rather than silently dropped", () => {
      const { result } = renderHook(() => useRemoteControl(AS_VIEWER));
      deliver("alice", { t: "cap", surface: "monitor", desktop: true });
      act(() => result.current.requestControl());

      deliver("alice", { t: "deny" });
      expect(result.current.status).toBe("denied");
    });

    test("pointer streams go out lossy, everything else reliable", () => {
      const { result } = renderHook(() => useRemoteControl(AS_VIEWER));
      deliver("alice", { t: "cap", surface: "monitor", desktop: true });

      act(() => result.current.sendInput([{ kind: "move", x: 0.1, y: 0.2 }]));
      act(() => result.current.sendInput([{ kind: "button", button: "left", down: true }]));

      const inputs = sent().filter((s) => s.message.t === "in");
      expect(inputs[0]!.options.reliable).toBe(false);
      expect(inputs[1]!.options.reliable).toBe(true);
      expect(inputs[0]!.options.destinationIdentities).toEqual(["alice"]);
    });
  });
});
