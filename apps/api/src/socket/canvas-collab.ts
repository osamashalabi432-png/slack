import * as Y from "yjs";
import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@openslaq/shared";
import { asPageId, asUserId } from "@openslaq/shared";
import { canReadPage } from "../pages/service";
import { captureException } from "../sentry";

type CollabSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface Room {
  /** Every edit so far, merged into one opaque Yjs update. */
  state: Uint8Array | null;
  members: Set<string>;
  /** Socket asked to seed the shared doc from `page.content`; cleared once any
   *  update lands (or that socket leaves). */
  seeder: string | null;
  dropTimer: ReturnType<typeof setTimeout> | null;
}

// pageId -> room. Kept for a short grace period after the last person leaves so
// a reload / brief disconnect doesn't lose in-flight edits.
const rooms = new Map<string, Room>();
const GRACE_MS = 60_000;
const roomKey = (pageId: string) => `canvas:${pageId}`;

function getRoom(pageId: string): Room {
  let room = rooms.get(pageId);
  if (!room) {
    room = { state: null, members: new Set(), seeder: null, dropTimer: null };
    rooms.set(pageId, room);
  }
  if (room.dropTimer) {
    clearTimeout(room.dropTimer);
    room.dropTimer = null;
  }
  return room;
}

/** Wire the canvas real-time relay onto one connected socket. */
export function registerCanvasCollab(socket: CollabSocket, userId: string): void {
  const joined = new Set<string>();

  const leave = (pageId: string) => {
    const room = rooms.get(pageId);
    joined.delete(pageId);
    void socket.leave(roomKey(pageId));
    if (!room) return;
    room.members.delete(socket.id);
    if (room.seeder === socket.id) room.seeder = null;
    if (room.members.size === 0 && !room.dropTimer) {
      room.dropTimer = setTimeout(() => {
        if (room.members.size === 0) rooms.delete(pageId);
      }, GRACE_MS);
    }
  };

  socket.on("canvas:collab-join", async ({ pageId }) => {
    try {
      if (!(await canReadPage(asPageId(pageId), asUserId(userId)))) return;
    } catch (err) {
      captureException(err, { userId, op: "canvas:collab-join" });
      return;
    }

    const room = getRoom(pageId);
    await socket.join(roomKey(pageId));
    room.members.add(socket.id);
    joined.add(pageId);

    const seed = !room.state && room.seeder === null;
    if (seed) room.seeder = socket.id;
    socket.emit("canvas:collab-sync", { pageId, state: room.state ?? null, seed });
  });

  socket.on("canvas:collab-update", ({ pageId, update }) => {
    const room = rooms.get(pageId);
    if (!room || !room.members.has(socket.id)) return;
    const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
    room.state = room.state ? Y.mergeUpdates([room.state, bytes]) : bytes;
    room.seeder = null;
    socket.to(roomKey(pageId)).emit("canvas:collab-update", { pageId, update: bytes });
  });

  socket.on("canvas:collab-awareness", ({ pageId, update }) => {
    const room = rooms.get(pageId);
    if (!room || !room.members.has(socket.id)) return;
    const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
    socket.to(roomKey(pageId)).emit("canvas:collab-awareness", { pageId, update: bytes });
  });

  socket.on("canvas:collab-leave", ({ pageId }) => leave(pageId));

  socket.on("disconnect", () => {
    // leave() mutates `joined`, so iterate a snapshot.
    for (const pageId of Array.from(joined)) leave(pageId);
  });
}

/** Test / diagnostics only. */
export function __collabRoomCount(): number {
  return rooms.size;
}
