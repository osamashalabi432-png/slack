import { describe, test, expect, beforeAll } from "bun:test";
import { createTestClient, createTestWorkspace, testId } from "./helpers/api-client";

interface DatabaseResponse {
  id: string;
  channelId: string;
  tabId: string | null;
  name: string;
  properties: { id: string; name: string; type: string; options?: { id: string }[] }[];
  views: { id: string; type: string; groupByPropertyId?: string | null; datePropertyId?: string | null }[];
}

interface RowResponse {
  id: string;
  databaseId: string;
  position: number;
  values: Record<string, unknown>;
}

describe("canvas databases", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>["client"];
  let slug: string;
  let channelId: string;
  let databaseId: string;

  beforeAll(async () => {
    const ctx = await createTestClient();
    client = ctx.client;

    const workspace = await createTestWorkspace(client);
    slug = workspace.slug;

    const chRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `db-test-${testId()}` },
    });
    channelId = ((await chRes.json()) as { id: string }).id;

    const dbRes = await client.api.workspaces[":slug"].channels[":id"].databases.$post({
      param: { slug, id: channelId },
      json: { name: "Projects", tabId: null },
    });
    databaseId = ((await dbRes.json()) as DatabaseResponse).id;
  });

  test("a new database ships with the default schema and three views", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get({
      param: { slug, id: channelId, databaseId },
    });
    expect(res.status).toBe(200);

    const data = (await res.json()) as { database: DatabaseResponse; rows: RowResponse[] };
    expect(data.database.name).toBe("Projects");
    expect(data.rows).toEqual([]);

    expect(data.database.properties.map((p) => p.type)).toContain("title");
    expect(data.database.properties.map((p) => p.id)).toEqual([
      "title",
      "status",
      "priority",
      "date",
      "notes",
    ]);

    // The calendar is its own block, so the combined database does not repeat it.
    expect(data.database.views.map((v) => v.type).sort()).toEqual(["board", "table"]);
    const board = data.database.views.find((v) => v.type === "board");
    expect(board?.groupByPropertyId).toBe("status");
  });

  test("a calendar preset creates a single-view block", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases.$post({
      param: { slug, id: channelId },
      json: { name: "Calendar", tabId: null, preset: "calendar" },
    });
    expect(res.status).toBe(201);

    const database = (await res.json()) as DatabaseResponse;
    expect(database.views).toHaveLength(1);
    expect(database.views[0]?.type).toBe("calendar");
    expect(database.views[0]?.datePropertyId).toBe("date");
    expect(database.properties.some((p) => p.type === "title")).toBe(true);
  });

  test("board and table presets each create their own single view", async () => {
    for (const preset of ["board", "table"] as const) {
      const res = await client.api.workspaces[":slug"].channels[":id"].databases.$post({
        param: { slug, id: channelId },
        json: { name: preset, tabId: null, preset },
      });
      const database = (await res.json()) as DatabaseResponse;
      expect(database.views).toHaveLength(1);
      expect(database.views[0]?.type).toBe(preset);
    }
  });

  test("omitting the preset still yields the full board-and-table block", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases.$post({
      param: { slug, id: channelId },
      json: { name: "Everything", tabId: null },
    });
    const database = (await res.json()) as DatabaseResponse;
    expect(database.views.map((v) => v.type)).toEqual(["board", "table"]);
  });

  test("rejects an unknown preset", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases.$post({
      param: { slug, id: channelId },
      // @ts-expect-error — deliberately invalid preset
      json: { name: "Nope", tabId: null, preset: "gantt" },
    });
    expect(res.status).toBe(400);
  });

  test("adds rows and keeps their order", async () => {
    const first = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post({
      param: { slug, id: channelId, databaseId },
      json: { values: { title: "First task", status: "not-started" } },
    });
    expect(first.status).toBe(201);
    expect(((await first.json()) as RowResponse).position).toBe(0);

    const second = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post({
      param: { slug, id: channelId, databaseId },
      json: { values: { title: "Second task", status: "in-progress" } },
    });
    expect(((await second.json()) as RowResponse).position).toBe(1);

    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get({
      param: { slug, id: channelId, databaseId },
    });
    const data = (await res.json()) as { rows: RowResponse[] };
    expect(data.rows.map((r) => r.values.title)).toEqual(["First task", "Second task"]);
  });

  test("moving a card between columns persists the new status", async () => {
    const created = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post({
      param: { slug, id: channelId, databaseId },
      json: { values: { title: "Drag me", status: "not-started" } },
    });
    const row = (await created.json()) as RowResponse;

    const moved = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows[":rowId"].$patch({
      param: { slug, id: channelId, databaseId, rowId: row.id },
      json: { values: { ...row.values, status: "done" } },
    });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as RowResponse).values.status).toBe("done");

    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get({
      param: { slug, id: channelId, databaseId },
    });
    const data = (await res.json()) as { rows: RowResponse[] };
    expect(data.rows.find((r) => r.id === row.id)?.values.status).toBe("done");
  });

  test("stores a date value for the calendar view", async () => {
    const created = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post({
      param: { slug, id: channelId, databaseId },
      json: { values: { title: "Scheduled", date: "2026-08-21" } },
    });
    expect(((await created.json()) as RowResponse).values.date).toBe("2026-08-21");
  });

  test("renames the database and rewrites its views", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$patch({
      param: { slug, id: channelId, databaseId },
      json: {
        name: "Roadmap",
        views: [{ id: "board", name: "By status", type: "board", groupByPropertyId: "priority" }],
      },
    });
    expect(res.status).toBe(200);

    const updated = (await res.json()) as DatabaseResponse;
    expect(updated.name).toBe("Roadmap");
    expect(updated.views).toHaveLength(1);
    expect(updated.views[0]?.groupByPropertyId).toBe("priority");
  });

  test("rejects an unknown view type", async () => {
    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$patch({
      param: { slug, id: channelId, databaseId },
      // @ts-expect-error — deliberately invalid view type
      json: { views: [{ id: "x", name: "Gantt", type: "gantt" }] },
    });
    expect(res.status).toBe(400);
  });

  test("deletes a row", async () => {
    const created = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows.$post({
      param: { slug, id: channelId, databaseId },
      json: { values: { title: "Temporary" } },
    });
    const row = (await created.json()) as RowResponse;

    const del = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].rows[":rowId"].$delete({
      param: { slug, id: channelId, databaseId, rowId: row.id },
    });
    expect(del.status).toBe(200);

    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get({
      param: { slug, id: channelId, databaseId },
    });
    const data = (await res.json()) as { rows: RowResponse[] };
    expect(data.rows.some((r) => r.id === row.id)).toBe(false);
  });

  test("a database from another channel is not reachable", async () => {
    const otherRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `db-other-${testId()}` },
    });
    const otherChannelId = ((await otherRes.json()) as { id: string }).id;

    const res = await client.api.workspaces[":slug"].channels[":id"].databases[":databaseId"].$get({
      param: { slug, id: otherChannelId, databaseId },
    });
    expect(res.status).toBe(404);
  });

  test("non-members cannot read a private channel's database", async () => {
    const privRes = await client.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `db-private-${testId()}`, type: "private" },
    });
    const priv = (await privRes.json()) as { id: string };

    const outsider = await createTestClient({
      id: "db-outsider-001",
      displayName: "DB Outsider",
      email: "db-outsider@openslaq.dev",
      emailVerified: true,
    });
    const res = await outsider.client.api.workspaces[":slug"].channels[":id"].databases.$post({
      param: { slug, id: priv.id },
      json: { name: "Sneaky", tabId: null },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
