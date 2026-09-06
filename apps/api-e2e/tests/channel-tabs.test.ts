import { describe, test, expect, beforeAll } from "bun:test";
import { createTestClient, createTestWorkspace, testId } from "./helpers/api-client";

interface TabResponse {
  id: string;
  channelId: string;
  type: string;
  name: string;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("channel tabs", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>["client"];
  let slug: string;
  let channelId: string;

  beforeAll(async () => {
    const ctx = await createTestClient();
    client = ctx.client;

    const workspace = await createTestWorkspace(client);
    slug = workspace.slug;

    const chRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `tab-test-${testId()}` },
    });
    const channel = (await chRes.json()) as { id: string };
    channelId = channel.id;
  });

  test("list tabs on a fresh channel → 200 with empty array", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].tabs.$get({
      param: { slug, id: channelId },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tabs: unknown[] };
    expect(data.tabs).toEqual([]);
  });

  test("create canvas tab → 201", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Project plan" },
    });
    expect(res.status).toBe(201);
    const tab = (await res.json()) as TabResponse;
    expect(tab.type).toBe("canvas");
    expect(tab.name).toBe("Project plan");
    expect(tab.channelId).toBe(channelId);
    expect(tab.position).toBe(0);
  });

  test("rejects an unknown tab type", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      // @ts-expect-error — deliberately invalid type
      json: { type: "spreadsheet", name: "Nope" },
    });
    expect(res.status).toBe(400);
  });

  test("new tabs append to the end of the strip", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Retro notes" },
    });
    const tab = (await res.json()) as TabResponse;
    expect(tab.position).toBe(1);

    const listRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$get({
      param: { slug, id: channelId },
    });
    const data = (await listRes.json()) as { tabs: TabResponse[] };
    expect(data.tabs.map((t) => t.name)).toEqual(["Project plan", "Retro notes"]);
  });

  test("reorders tabs and rejects a bad id list", async () => {
    const chRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `tab-reorder-${testId()}` },
    });
    const ch = ((await chRes.json()) as { id: string }).id;

    const made: TabResponse[] = [];
    for (const name of ["Alpha", "Bravo", "Charlie"]) {
      const r = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
        param: { slug, id: ch },
        json: { type: "canvas", name },
      });
      made.push((await r.json()) as TabResponse);
    }
    const [a, b, c] = made;

    // Charlie, Alpha, Bravo
    const reordered = await client.api.workspaces[":slug"].channels[":id"].tabs.reorder.$put({
      param: { slug, id: ch },
      json: { orderedIds: [c!.id, a!.id, b!.id] },
    });
    expect(reordered.status).toBe(200);
    const body = (await reordered.json()) as { tabs: TabResponse[] };
    expect(body.tabs.map((t) => t.name)).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(body.tabs.map((t) => t.position)).toEqual([0, 1, 2]);

    // Persisted.
    const listRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$get({
      param: { slug, id: ch },
    });
    const listed = (await listRes.json()) as { tabs: TabResponse[] };
    expect(listed.tabs.map((t) => t.name)).toEqual(["Charlie", "Alpha", "Bravo"]);

    // A partial / wrong list is refused, order unchanged.
    const bad = await client.api.workspaces[":slug"].channels[":id"].tabs.reorder.$put({
      param: { slug, id: ch },
      json: { orderedIds: [a!.id, b!.id] },
    });
    expect(bad.status).toBe(400);
  });

  test("renaming a canvas tab's page renames the tab", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Draft plan" },
    });
    const tab = (await createRes.json()) as TabResponse;

    // Open (create) the page behind the tab.
    const pageRes = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].page.$post({
      param: { slug, id: channelId, tabId: tab.id },
    });
    const { pageId } = (await pageRes.json()) as { pageId: string };

    // Rename the document.
    const patchRes = await client.api.workspaces[":slug"].pages[":pageId"].$patch({
      param: { slug, pageId },
      json: { title: "Q3 Rollout Plan" },
    });
    expect(patchRes.status).toBe(200);

    // The tab strip follows.
    const listRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$get({
      param: { slug, id: channelId },
    });
    const data = (await listRes.json()) as { tabs: TabResponse[] };
    expect(data.tabs.find((t) => t.id === tab.id)?.name).toBe("Q3 Rollout Plan");
  });

  test("a new canvas starts with no content", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Empty" },
    });
    const tab = (await createRes.json()) as TabResponse;

    const res = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$get({
      param: { slug, id: channelId, tabId: tab.id },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { content: unknown };
    expect(data.content).toBeNull();
  });

  test("saves and reads back canvas content", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Notes" },
    });
    const tab = (await createRes.json()) as TabResponse;

    const saveRes = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].content.$put({
      param: { slug, id: channelId, tabId: tab.id },
      json: { content: doc("Ship the tabs feature") },
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { updatedAt: string };
    expect(typeof saved.updatedAt).toBe("string");

    const getRes = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$get({
      param: { slug, id: channelId, tabId: tab.id },
    });
    const data = (await getRes.json()) as { content: Record<string, unknown> | null; updatedBy: string | null };
    expect(data.content).toEqual(doc("Ship the tabs feature") as unknown as Record<string, unknown>);
    expect(data.updatedBy).not.toBeNull();
  });

  test("rejects oversized canvas content", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Big" },
    });
    const tab = (await createRes.json()) as TabResponse;

    const res = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].content.$put({
      param: { slug, id: channelId, tabId: tab.id },
      json: { content: doc("x".repeat(1_000_001)) },
    });
    expect(res.status).toBe(400);
  });

  test("renames a tab", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Before" },
    });
    const tab = (await createRes.json()) as TabResponse;

    const res = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$patch({
      param: { slug, id: channelId, tabId: tab.id },
      json: { name: "After" },
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as TabResponse;
    expect(updated.name).toBe("After");
  });

  test("deletes a tab, after which it is gone", async () => {
    const createRes = await client.api.workspaces[":slug"].channels[":id"].tabs.$post({
      param: { slug, id: channelId },
      json: { type: "canvas", name: "Temporary" },
    });
    const tab = (await createRes.json()) as TabResponse;

    const delRes = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$delete({
      param: { slug, id: channelId, tabId: tab.id },
    });
    expect(delRes.status).toBe(200);

    const getRes = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$get({
      param: { slug, id: channelId, tabId: tab.id },
    });
    expect(getRes.status).toBe(404);
  });

  test("deleting an unknown tab → 404", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].tabs[":tabId"].$delete({
      param: { slug, id: channelId, tabId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(res.status).toBe(404);
  });

  test("non-members cannot read a private channel's tabs", async () => {
    const privRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `tab-private-${testId()}`, type: "private" },
    });
    const priv = (await privRes.json()) as { id: string };

    // A different user entirely — createTestClient() with no overrides is the same
    // account that owns the workspace.
    const outsider = await createTestClient({
      id: "tab-outsider-001",
      displayName: "Tab Outsider",
      email: "tab-outsider@openslaq.dev",
      emailVerified: true,
    });
    const res = await outsider.client.api.workspaces[":slug"].channels[":id"].tabs.$get({
      param: { slug, id: priv.id },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
