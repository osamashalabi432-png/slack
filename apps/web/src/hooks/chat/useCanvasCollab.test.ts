import { describe, test, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { renderHook, act } from "../../test-utils";
import { useCanvasCollab } from "./useCanvasCollab";

type Handler = (payload: unknown) => void;

function makeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emitted: [] as { event: string; payload: unknown }[],
    on(event: string, fn: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    off(event: string, fn: Handler) {
      handlers.get(event)?.delete(fn);
    },
    emit(event: string, payload: unknown) {
      this.emitted.push({ event, payload });
    },
    /** Deliver a server → client event to the hook. */
    server(event: string, payload: unknown) {
      handlers.get(event)?.forEach((fn) => fn(payload));
    },
    events(): string[] {
      return this.emitted.map((e) => e.event);
    },
  };
}

let socket: ReturnType<typeof makeSocket>;
vi.mock("../useSocket", () => ({ useSocket: () => ({ socket }) }));

beforeEach(() => {
  socket = makeSocket();
});

const opts = (over: Partial<Parameters<typeof useCanvasCollab>[0]> = {}) => ({
  enabled: true,
  pageId: "page-1",
  initialContent: { type: "doc", content: [] },
  onSeed: vi.fn(),
  ...over,
});

describe("useCanvasCollab", () => {
  test("joins the room on mount and leaves on unmount", () => {
    const { unmount } = renderHook(() => useCanvasCollab(opts()));
    expect(socket.emitted[0]).toEqual({
      event: "canvas:collab-join",
      payload: { pageId: "page-1" },
    });
    unmount();
    expect(socket.events()).toContain("canvas:collab-leave");
  });

  test("seeds from the saved content only when the relay says so", () => {
    const onSeed = vi.fn();
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    const { result } = renderHook(() => useCanvasCollab(opts({ onSeed, initialContent: content })));

    act(() => socket.server("canvas:collab-sync", { pageId: "page-1", state: null, seed: false }));
    expect(onSeed).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(true);

    act(() => socket.server("canvas:collab-sync", { pageId: "page-1", state: null, seed: true }));
    expect(onSeed).toHaveBeenCalledWith(content);
  });

  test("broadcasts local Yjs edits but not ones applied from the relay", () => {
    const { result } = renderHook(() => useCanvasCollab(opts()));
    socket.emitted.length = 0;

    act(() => result.current.ydoc.getText("body").insert(0, "hello"));
    expect(socket.events()).toContain("canvas:collab-update");

    // A relay-originated update must not echo straight back out.
    const source = new Y.Doc();
    source.getText("body").insert(0, "world");
    const update = Y.encodeStateAsUpdate(source);
    socket.emitted.length = 0;
    act(() => Y.applyUpdate(result.current.ydoc, update, "remote"));
    expect(socket.events()).not.toContain("canvas:collab-update");
  });

  test("relays a remote doc update into the shared doc", () => {
    const { result } = renderHook(() => useCanvasCollab(opts()));
    const source = new Y.Doc();
    source.getText("body").insert(0, "abc");
    const update = Y.encodeStateAsUpdate(source);

    act(() => socket.server("canvas:collab-update", { pageId: "page-1", update }));
    expect(result.current.ydoc.getText("body").toString()).toBe("abc");
  });

  test("does nothing when disabled", () => {
    renderHook(() => useCanvasCollab(opts({ enabled: false })));
    expect(socket.emitted).toHaveLength(0);
  });
});
