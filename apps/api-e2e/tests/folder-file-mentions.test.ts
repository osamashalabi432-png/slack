import { describe, test, expect, beforeAll } from "bun:test";
import { createTestClient, createTestWorkspace, testId } from "./helpers/api-client";

interface Tab {
  id: string;
}

const linkItem = {
  id: "lnk-1",
  kind: "link" as const,
  name: "Spec doc",
  url: "https://spec.example.com/",
  addedAt: "2026-01-01T00:00:00.000Z",
};

describe("folder file mentions", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>["client"];
  let slug: string;
  let channelA: string;
  let channelB: string;
  let folderTab: string;
  let canvasTab: string;

  beforeAll(async () => {
    const ctx = await createTestClient();
    client = ctx.client;
    slug = (await createTestWorkspace(client)).slug;

    const mk = async (name: string) => {
      const res = await client.api.workspaces[":slug"].channels.$post({
        param: { slug },
        json: { name: `${name}-${testId()}` },
      });
      return ((await res.json()) as { id: string }).id;
    };
    channelA = await mk("file-mention-a");
    channelB = await mk("file-mention-b");

    const folderRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelA },
      json: { type: "folder", name: "Files" },
    });
    folderTab = ((await folderRes.json()) as Tab).id;

    const canvasRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelA },
      json: { type: "canvas", name: "Notes" },
    });
    canvasTab = ((await canvasRes.json()) as Tab).id;

    await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].content.$put({
      param: { slug, id: channelA, tabId: folderTab },
      json: { content: { items: [linkItem] } },
    });
  });

  const resolve = (id: string, tabId: string, itemId: string) =>
    client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].items[":itemId"]["download-url"].$get({
      param: { slug, id, tabId, itemId },
    });

  test("resolves a link entry to its name, kind and URL", async () => {
    const res = await resolve(channelA, folderTab, "lnk-1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; kind: string; downloadUrl: string };
    expect(body).toEqual({ name: "Spec doc", kind: "link", downloadUrl: "https://spec.example.com/" });
  });

  test("unknown entry id → 404", async () => {
    const res = await resolve(channelA, folderTab, "does-not-exist");
    expect(res.status).toBe(404);
  });

  test("a tab from another channel → 404 (mentions stay in the same section)", async () => {
    const res = await resolve(channelB, folderTab, "lnk-1");
    expect(res.status).toBe(404);
  });

  test("a non-folder tab → 404", async () => {
    const res = await resolve(channelA, canvasTab, "lnk-1");
    expect(res.status).toBe(404);
  });

  test("a <@file:…> token in a message does not become a user mention", async () => {
    const content = `See <@file:${folderTab}:lnk-1> for the spec`;
    const res = await client.api.workspaces[":slug"].channels[":id"].messages.$post({
      param: { slug, id: channelA },
      json: { content },
    });
    expect(res.status).toBe(201);
    const msg = (await res.json()) as unknown as { content: string; mentions: unknown[] };
    expect(msg.content).toBe(content);
    expect(msg.mentions).toEqual([]);
  });
});
