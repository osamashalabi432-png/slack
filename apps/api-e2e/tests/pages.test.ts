import { describe, test, expect, beforeAll } from "bun:test";
import {
  createTestClient,
  createTestWorkspace,
  addToWorkspace,
  testId,
  type TestApiClient,
} from "./helpers/api-client";

interface PageResponse {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  position: number;
  hasChildren: boolean;
  isFavourite: boolean;
  archived: boolean;
  restrictedToGroupId: string | null;
}

interface PageDetail extends PageResponse {
  content: Record<string, unknown> | null;
  breadcrumbs: { id: string; title: string }[];
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("pages", () => {
  let admin: TestApiClient;
  let member: TestApiClient;
  let memberId: string;
  let slug: string;

  async function newPage(title: string, parentId?: string | null, client = admin) {
    const res = await client.api.workspaces[":slug"].pages.$post({
      param: { slug },
      json: { title, parentId: parentId ?? null },
    });
    expect(res.status).toBe(201);
    return (await res.json()) as PageResponse;
  }

  async function detail(pageId: string, client = admin) {
    const res = await client.api.workspaces[":slug"].pages[":pageId"].$get({
      param: { slug, pageId },
    });
    return { status: res.status, body: (await res.json()) as PageDetail };
  }

  beforeAll(async () => {
    const ownerCtx = await createTestClient();
    admin = ownerCtx.client;
    slug = (await createTestWorkspace(admin)).slug;

    const memberCtx = await createTestClient({
      id: `page-member-${testId()}`,
      email: `page-member-${testId()}@example.com`,
      displayName: "Page Member",
    });
    member = memberCtx.client;
    memberId = memberCtx.user.id;
    await addToWorkspace(admin, slug, member);
  });

  describe("the tree", () => {
    test("a page can be created inside another, without limit", async () => {
      const root = await newPage("Handbook");
      const chapter = await newPage("Engineering", root.id);
      const section = await newPage("Onboarding", chapter.id);

      const { body } = await detail(section.id);
      expect(body.parentId).toBe(chapter.id);
      expect(body.breadcrumbs.map((c) => c.title)).toEqual(["Handbook", "Engineering"]);
    });

    test("a parent reports that it has children, so the tree can show a twisty", async () => {
      const root = await newPage("Parent");
      const listBefore = await admin.api.workspaces[":slug"].pages.$get({ param: { slug } });
      const before = ((await listBefore.json()) as PageResponse[]).find((p) => p.id === root.id);
      expect(before?.hasChildren).toBe(false);

      await newPage("Child", root.id);

      const listAfter = await admin.api.workspaces[":slug"].pages.$get({ param: { slug } });
      const after = ((await listAfter.json()) as PageResponse[]).find((p) => p.id === root.id);
      expect(after?.hasChildren).toBe(true);
    });

    test("an untitled page is named rather than left blank", async () => {
      const res = await admin.api.workspaces[":slug"].pages.$post({
        param: { slug },
        json: { title: "   " },
      });
      const page = (await res.json()) as PageResponse;
      expect(page.title).toBe("Untitled");
    });
  });

  describe("moving", () => {
    test("a page carries its sub-pages to the new parent", async () => {
      const a = await newPage("A");
      const b = await newPage("B");
      const child = await newPage("A child", a.id);

      const res = await admin.api.workspaces[":slug"].pages[":pageId"].move.$post({
        param: { slug, pageId: a.id },
        json: { parentId: b.id },
      });
      expect(res.status).toBe(200);

      const { body } = await detail(child.id);
      expect(body.breadcrumbs.map((c) => c.title)).toEqual(["B", "A"]);
    });

    test("a page cannot be moved inside its own sub-page", async () => {
      const parent = await newPage("Parent");
      const child = await newPage("Child", parent.id);
      const grandchild = await newPage("Grandchild", child.id);

      for (const target of [child.id, grandchild.id]) {
        const res = await admin.api.workspaces[":slug"].pages[":pageId"].move.$post({
          param: { slug, pageId: parent.id },
          json: { parentId: target },
        });
        expect(res.status).toBe(400);
      }
    });

    test("a page cannot be put inside itself", async () => {
      const page = await newPage("Self");
      const res = await admin.api.workspaces[":slug"].pages[":pageId"].move.$post({
        param: { slug, pageId: page.id },
        json: { parentId: page.id },
      });
      expect(res.status).toBe(400);
    });

    test("moving to the root is allowed", async () => {
      const parent = await newPage("Top");
      const child = await newPage("Nested", parent.id);

      const res = await admin.api.workspaces[":slug"].pages[":pageId"].move.$post({
        param: { slug, pageId: child.id },
        json: { parentId: null },
      });
      expect(res.status).toBe(200);

      const { body } = await detail(child.id);
      expect(body.parentId).toBeNull();
      expect(body.breadcrumbs).toEqual([]);
    });
  });

  describe("body and furniture", () => {
    test("the body round-trips, and the icon and cover stick", async () => {
      const page = await newPage("Notes");
      const res = await admin.api.workspaces[":slug"].pages[":pageId"].$patch({
        param: { slug, pageId: page.id },
        json: { content: doc("hello notion"), icon: "📓", coverUrl: "https://example.com/c.png" },
      });
      expect(res.status).toBe(200);

      const { body } = await detail(page.id);
      expect(JSON.stringify(body.content)).toContain("hello notion");
      expect(body.icon).toBe("📓");
      expect(body.coverUrl).toBe("https://example.com/c.png");
    });

    test("starring is per person", async () => {
      const page = await newPage("Starred");
      await admin.api.workspaces[":slug"].pages[":pageId"].favourite.$post({
        param: { slug, pageId: page.id },
        json: { favourite: true },
      });

      expect((await detail(page.id)).body.isFavourite).toBe(true);
      expect((await detail(page.id, member)).body.isFavourite).toBe(false);
    });
  });

  describe("archiving", () => {
    test("archiving a page hides it and everything under it", async () => {
      const root = await newPage("Doomed");
      const child = await newPage("Doomed child", root.id);

      await admin.api.workspaces[":slug"].pages[":pageId"].archive.$post({
        param: { slug, pageId: root.id },
        json: { archived: true },
      });

      const res = await admin.api.workspaces[":slug"].pages.$get({ param: { slug } });
      const list = (await res.json()) as PageResponse[];
      expect(list.some((p) => p.id === root.id)).toBe(false);
      expect(list.some((p) => p.id === child.id)).toBe(false);

      // Nothing was destroyed — restoring brings the branch back.
      await admin.api.workspaces[":slug"].pages[":pageId"].archive.$post({
        param: { slug, pageId: root.id },
        json: { archived: false },
      });
      const back = (await (
        await admin.api.workspaces[":slug"].pages.$get({ param: { slug } })
      ).json()) as PageResponse[];
      expect(back.some((p) => p.id === child.id)).toBe(true);
    });
  });

  describe("restricting a page to a group", () => {
    async function restrictedTree() {
      const groupRes = await admin.api.workspaces[":slug"].groups.$post({
        param: { slug },
        json: { name: "Secret", handle: `secret-${testId()}` },
      });
      const group = (await groupRes.json()) as { id: string };

      const root = await newPage("Secret plans");
      const child = await newPage("Deeper", root.id);
      await admin.api.workspaces[":slug"].pages[":pageId"].$patch({
        param: { slug, pageId: root.id },
        json: { restrictedToGroupId: group.id },
      });
      return { group, root, child };
    }

    test("someone outside the group cannot open it, or its children", async () => {
      const { root, child } = await restrictedTree();

      expect((await detail(root.id, member)).status).toBe(403);
      // The child carries no restriction of its own — it inherits.
      expect((await detail(child.id, member)).status).toBe(403);
    });

    test("the restricted branch is missing from their tree entirely", async () => {
      const { root, child } = await restrictedTree();

      const res = await member.api.workspaces[":slug"].pages.$get({ param: { slug } });
      const list = (await res.json()) as PageResponse[];
      expect(list.some((p) => p.id === root.id)).toBe(false);
      expect(list.some((p) => p.id === child.id)).toBe(false);
    });

    test("joining the group opens the whole branch", async () => {
      const { group, root, child } = await restrictedTree();

      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      expect((await detail(root.id, member)).status).toBe(200);
      expect((await detail(child.id, member)).status).toBe(200);
    });

    test("an unrestricted page stays open to the workspace", async () => {
      const page = await newPage("Open to all");
      expect((await detail(page.id, member)).status).toBe(200);
    });
  });
});
