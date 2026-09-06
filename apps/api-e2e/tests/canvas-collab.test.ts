import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import * as Y from "yjs";
import { setupSocketHandlers } from "../../api/src/socket";
import { removeAllSocketsForUser } from "../../api/src/presence/service";
import {
  createTestClient,
  testId,
  createTestWorkspace,
  addToWorkspace,
  signTestJwt,
} from "./helpers/api-client";

let httpServer: ReturnType<typeof createServer>;
let port: number;
let slug: string;
let channelId: string;
let pageId: string;
const tokens: Record<"a" | "b" | "c", string> = { a: "", b: "", c: "" };
const userIds: string[] = [];
const sockets: ClientSocket[] = [];

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    // The server registers its per-socket listeners inside an async connection
    // handler; `presence:sync` marks the end of it, so wait for that before
    // emitting anything or events get dropped.
    s.on("presence:sync", () => resolve(s));
    s.on("connect_error", (err) => reject(new Error(`connect_error: ${err.message}`)));
    setTimeout(() => reject(new Error("connect timeout")), 8000);
  });
}

function waitFor<T>(s: ClientSocket, event: string, ms = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => {
      clearTimeout(timer);
      s.off(event, handler as never);
      resolve(data);
    };
    const timer = setTimeout(() => {
      s.off(event, handler as never);
      reject(new Error(`timeout waiting for ${event}`));
    }, ms);
    s.on(event, handler as never);
  });
}

async function join(s: ClientSocket) {
  const sync = waitFor<{ pageId: string; state: ArrayBuffer | null; seed: boolean }>(
    s,
    "canvas:collab-sync",
  );
  s.emit("canvas:collab-join", { pageId });
  return sync;
}

beforeAll(async () => {
  httpServer = createServer();
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" }, transports: ["websocket"] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setupSocketHandlers(io as any);
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
  const addr = httpServer.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  port = addr.port;

  const id = testId();
  const make = async (key: "a" | "b" | "c", n: number) => {
    const uid = `collab-${key}-${id}`;
    userIds.push(uid);
    const ctx = await createTestClient({
      id: uid,
      displayName: `Collab ${key.toUpperCase()}`,
      email: `c${n}-${id}@openslaq.dev`,
    });
    tokens[key] = await signTestJwt(ctx.user);
    return ctx;
  };
  const ctxA = await make("a", 1);
  const ctxB = await make("b", 2);
  const ctxC = await make("c", 3);

  const ws = await createTestWorkspace(ctxA.client);
  slug = ws.slug;
  await addToWorkspace(ctxA.client, slug, ctxB.client);
  await addToWorkspace(ctxA.client, slug, ctxC.client);

  const chRes = await ctxA.client.api.workspaces[":slug"].channels.$post({
    param: { slug },
    json: { name: `collab-${id}` },
  });
  channelId = ((await chRes.json()) as { id: string }).id;
  for (const ctx of [ctxB, ctxC]) {
    await ctx.client.api.workspaces[":slug"].channels[":id"].join.$post({ param: { slug, id: channelId } });
  }

  const tabRes = await ctxA.client.api.workspaces[":slug"].channels[":id"].tabs.$post({
    param: { slug, id: channelId },
    json: { type: "canvas", name: "Shared doc" },
  });
  const tabId = ((await tabRes.json()) as { id: string }).id;
  const pageRes = await ctxA.client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].page.$post({
    param: { slug, id: channelId, tabId },
  });
  pageId = ((await pageRes.json()) as { pageId: string }).pageId;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  httpServer?.close();
  for (const uid of userIds) await removeAllSocketsForUser(uid).catch(() => {});
});

describe("canvas collaboration relay", () => {
  test("relays edits between peers and hands a late joiner the merged state", async () => {

    const a = await connect(tokens.a);
    const b = await connect(tokens.b);
    sockets.push(a, b);

    // First in the room is asked to seed from the saved page body.
    expect((await join(a)).seed).toBe(true);
    // Second joiner does not seed.
    expect((await join(b)).seed).toBe(false);

    // A edits; B receives the exact Yjs bytes.
    const doc = new Y.Doc();
    doc.getText("body").insert(0, "hello team");
    const update = Y.encodeStateAsUpdate(doc);

    const bGetsUpdate = waitFor<{ pageId: string; update: ArrayBuffer | Uint8Array }>(
      b,
      "canvas:collab-update",
    );
    a.emit("canvas:collab-update", { pageId, update });

    const received = await bGetsUpdate;
    expect(received.pageId).toBe(pageId);
    const applied = new Y.Doc();
    Y.applyUpdate(applied, new Uint8Array(received.update as ArrayBuffer));
    expect(applied.getText("body").toString()).toBe("hello team");

    // A brand-new joiner gets the merged room state, not a seed request.
    const c = await connect(tokens.c);
    sockets.push(c);
    const cSync = await join(c);
    expect(cSync.seed).toBe(false);
    expect(cSync.state).not.toBeNull();
    const fromState = new Y.Doc();
    Y.applyUpdate(fromState, new Uint8Array(cSync.state as ArrayBuffer));
    expect(fromState.getText("body").toString()).toBe("hello team");
  }, 25_000);
});
