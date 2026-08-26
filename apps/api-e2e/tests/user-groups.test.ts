import { describe, test, expect, beforeAll } from "bun:test";
import {
  createTestClient,
  createTestWorkspace,
  addToWorkspace,
  testId,
  type TestApiClient,
} from "./helpers/api-client";

interface GroupResponse {
  id: string;
  name: string;
  handle: string;
  purpose: string | null;
  showAsSection: boolean;
  memberCount: number;
  channelCount: number;
  isMember: boolean;
}

interface GroupDetail extends GroupResponse {
  members: { userId: string; displayName: string }[];
  channels: { channelId: string; name: string; isPrivate: boolean }[];
}

interface ChannelResponse {
  id: string;
  name: string;
  type: string;
}

describe("user groups", () => {
  let admin: TestApiClient;
  let member: TestApiClient;
  let memberId: string;
  let slug: string;

  async function makeChannel(name: string): Promise<ChannelResponse> {
    const res = await admin.api.workspaces[":slug"].channels.$post({
      param: { slug },
      json: { name: `${name}-${testId()}` },
    });
    return (await res.json()) as ChannelResponse;
  }

  async function makeGroup(overrides: Record<string, unknown> = {}) {
    const res = await admin.api.workspaces[":slug"].groups.$post({
      param: { slug },
      json: { name: "Marketing", handle: `marketing-${testId()}`, ...overrides },
    });
    expect(res.status).toBe(201);
    return (await res.json()) as GroupResponse;
  }

  beforeAll(async () => {
    const ownerCtx = await createTestClient();
    admin = ownerCtx.client;
    const workspace = await createTestWorkspace(admin);
    slug = workspace.slug;

    const memberCtx = await createTestClient({
      id: `group-member-${testId()}`,
      email: `group-member-${testId()}@example.com`,
      displayName: "Group Member",
    });
    member = memberCtx.client;
    memberId = memberCtx.user.id;
    await addToWorkspace(admin, slug, member);
  });

  describe("creating", () => {
    test("creates a group with a handle and lists it", async () => {
      const group = await makeGroup({ purpose: "all things marketing" });

      const listRes = await admin.api.workspaces[":slug"].groups.$get({ param: { slug } });
      expect(listRes.status).toBe(200);
      const groups = (await listRes.json()) as GroupResponse[];
      const found = groups.find((g) => g.id === group.id);
      expect(found?.purpose).toBe("all things marketing");
      expect(found?.showAsSection).toBe(true);
    });

    test("rejects handles that cannot follow an @", async () => {
      for (const handle of ["Marketing Team", "with space", "a", "trailing-"]) {
        const res = await admin.api.workspaces[":slug"].groups.$post({
          param: { slug },
          json: { name: "Bad", handle },
        });
        expect(res.status).toBe(400);
      }
    });

    test("a handle typed in capitals is normalised rather than refused", async () => {
      const raw = `MixedCase-${testId()}`;
      const res = await admin.api.workspaces[":slug"].groups.$post({
        param: { slug },
        json: { name: "Mixed", handle: raw },
      });
      expect(res.status).toBe(201);
      const group = (await res.json()) as GroupResponse;
      expect(group.handle).toBe(raw.toLowerCase());
    });

    test("rejects a handle that is already taken", async () => {
      const handle = `dupes-${testId()}`;
      await admin.api.workspaces[":slug"].groups.$post({
        param: { slug },
        json: { name: "First", handle },
      });
      const second = await admin.api.workspaces[":slug"].groups.$post({
        param: { slug },
        json: { name: "Second", handle },
      });
      expect(second.status).toBe(400);
    });

    test("a plain member cannot create a group", async () => {
      const res = await member.api.workspaces[":slug"].groups.$post({
        param: { slug },
        json: { name: "Sneaky", handle: `sneaky-${testId()}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("channels the group owns", () => {
    test("a public channel becomes private when the group takes it", async () => {
      const channel = await makeChannel("open-then-closed");
      expect(channel.type).toBe("public");
      const group = await makeGroup({ handle: `claims-${testId()}` });

      const res = await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });
      expect(res.status).toBe(200);
      const detail = (await res.json()) as GroupDetail;
      expect(detail.channels[0]?.isPrivate).toBe(true);
    });

    test("joining the group joins its channels; leaving takes them away", async () => {
      const channel = await makeChannel("marketing-only");
      const group = await makeGroup({ handle: `grants-${testId()}` });
      await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });

      // Outside the group, the channel is not in their list.
      const before = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const beforeList = (await before.json()) as ChannelResponse[];
      expect(beforeList.some((c) => c.id === channel.id)).toBe(false);

      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const after = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const afterList = (await after.json()) as ChannelResponse[];
      expect(afterList.some((c) => c.id === channel.id)).toBe(true);

      await admin.api.workspaces[":slug"].groups[":groupId"].members[":userId"].$delete({
        param: { slug, groupId: group.id, userId: memberId },
      });

      const gone = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const goneList = (await gone.json()) as ChannelResponse[];
      expect(goneList.some((c) => c.id === channel.id)).toBe(false);
    });

    test("leaving one group keeps channels a second group still grants", async () => {
      const shared = await makeChannel("shared-channel");
      const marketing = await makeGroup({ handle: `mkt-${testId()}` });
      const sales = await makeGroup({ handle: `sales-${testId()}` });

      for (const group of [marketing, sales]) {
        await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
          param: { slug, groupId: group.id },
          json: { channelIds: [shared.id] },
        });
        await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
          param: { slug, groupId: group.id },
          json: { userIds: [memberId] },
        });
      }

      await admin.api.workspaces[":slug"].groups[":groupId"].members[":userId"].$delete({
        param: { slug, groupId: marketing.id, userId: memberId },
      });

      const res = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const list = (await res.json()) as ChannelResponse[];
      expect(list.some((c) => c.id === shared.id)).toBe(true);
    });

    test("taking a channel out of a group removes the access it granted", async () => {
      const channel = await makeChannel("revoked");
      const group = await makeGroup({ handle: `revoke-${testId()}` });
      await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      await admin.api.workspaces[":slug"].groups[":groupId"].channels[":channelId"].$delete({
        param: { slug, groupId: group.id, channelId: channel.id },
      });

      const res = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const list = (await res.json()) as ChannelResponse[];
      expect(list.some((c) => c.id === channel.id)).toBe(false);
    });

    test("a direct message cannot be put under a group", async () => {
      const group = await makeGroup({ handle: `nodm-${testId()}` });
      const dmRes = await admin.api.workspaces[":slug"].dm.$post({
        param: { slug },
        json: { userId: memberId },
      });
      const dm = (await dmRes.json()) as unknown as { channel: { id: string } };

      const res = await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [dm.channel.id] },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("sidebar sections", () => {
    test("only groups the caller belongs to come back", async () => {
      const channel = await makeChannel("sectioned");
      const group = await makeGroup({ handle: `section-${testId()}`, name: "Sectioned Team" });
      await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });

      const before = await member.api.workspaces[":slug"].groups.sections.$get({ param: { slug } });
      const beforeSections = (await before.json()) as { groupId: string }[];
      expect(beforeSections.some((s) => s.groupId === group.id)).toBe(false);

      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const after = await member.api.workspaces[":slug"].groups.sections.$get({ param: { slug } });
      const sections = (await after.json()) as { groupId: string; channelIds: string[] }[];
      const mine = sections.find((s) => s.groupId === group.id);
      expect(mine?.channelIds).toContain(channel.id);
    });

    test("a group set to hide is left out of the sections", async () => {
      const group = await makeGroup({ handle: `hidden-${testId()}`, showAsSection: false });
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const res = await member.api.workspaces[":slug"].groups.sections.$get({ param: { slug } });
      const sections = (await res.json()) as { groupId: string }[];
      expect(sections.some((s) => s.groupId === group.id)).toBe(false);
    });
  });

  describe("mentioning a group", () => {
    test("notifies the roster, but only people who can read the channel", async () => {
      const channel = await makeChannel("mention-target");
      const group = await makeGroup({ handle: `ping-${testId()}` });
      await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const detail = (await (
        await admin.api.workspaces[":slug"].groups[":groupId"].$get({
          param: { slug, groupId: group.id },
        })
      ).json()) as GroupDetail;
      const handle = detail.handle;

      const sent = await admin.api.workspaces[":slug"].channels[":id"].messages.$post({
        param: { slug, id: channel.id },
        json: { content: `heads up <@group:${handle}>` },
      });
      expect(sent.status).toBe(201);
      const message = (await sent.json()) as { id: string; mentions?: { userId: string }[] };

      // Read it back as the mentioned member: the mention is recorded for them.
      const listed = await member.api.workspaces[":slug"].channels[":id"].messages.$get({
        param: { slug, id: channel.id },
        query: {},
      });
      const body = (await listed.json()) as {
        messages: { id: string; mentions?: { userId: string; type: string }[] }[];
      };
      const stored = body.messages.find((m) => m.id === message.id);
      expect(stored?.mentions?.some((m) => m.userId === memberId && m.type === "group")).toBe(true);
    });

    test("a group mention does not reach someone outside the channel", async () => {
      const channel = await makeChannel("closed-room");
      const group = await makeGroup({ handle: `orphan-${testId()}` });
      // The member is in the group but the group does not own this channel.
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });
      const detail = (await (
        await admin.api.workspaces[":slug"].groups[":groupId"].$get({
          param: { slug, groupId: group.id },
        })
      ).json()) as GroupDetail;

      const sent = await admin.api.workspaces[":slug"].channels[":id"].messages.$post({
        param: { slug, id: channel.id },
        json: { content: `hello <@group:${detail.handle}>` },
      });
      const message = (await sent.json()) as { id: string };

      const listed = await admin.api.workspaces[":slug"].channels[":id"].messages.$get({
        param: { slug, id: channel.id },
        query: {},
      });
      const body = (await listed.json()) as {
        messages: { id: string; mentions?: { userId: string }[] }[];
      };
      const stored = body.messages.find((m) => m.id === message.id);
      expect(stored?.mentions?.some((m) => m.userId === memberId)).toBe(false);
    });
  });

  describe("editing and deleting", () => {
    test("renaming and rehandling works, and members are unaffected", async () => {
      const group = await makeGroup({ handle: `rename-${testId()}` });
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const newHandle = `renamed-${testId()}`;
      const res = await admin.api.workspaces[":slug"].groups[":groupId"].$patch({
        param: { slug, groupId: group.id },
        json: { name: "Growth", handle: newHandle, purpose: "renamed" },
      });
      expect(res.status).toBe(200);
      const detail = (await res.json()) as GroupDetail;
      expect(detail.name).toBe("Growth");
      expect(detail.handle).toBe(newHandle);
      expect(detail.members.some((m) => m.userId === memberId)).toBe(true);
    });

    test("deleting a group leaves its channel intact for the people in it", async () => {
      const channel = await makeChannel("survives");
      const group = await makeGroup({ handle: `doomed-${testId()}` });
      await admin.api.workspaces[":slug"].groups[":groupId"].channels.$post({
        param: { slug, groupId: group.id },
        json: { channelIds: [channel.id] },
      });
      await admin.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });

      const del = await admin.api.workspaces[":slug"].groups[":groupId"].$delete({
        param: { slug, groupId: group.id },
      });
      expect(del.status).toBe(200);

      const res = await member.api.workspaces[":slug"].channels.$get({ param: { slug } });
      const list = (await res.json()) as ChannelResponse[];
      expect(list.some((c) => c.id === channel.id)).toBe(true);
    });

    test("a plain member cannot add people to a group", async () => {
      const group = await makeGroup({ handle: `guarded-${testId()}` });
      const res = await member.api.workspaces[":slug"].groups[":groupId"].members.$post({
        param: { slug, groupId: group.id },
        json: { userIds: [memberId] },
      });
      expect(res.status).toBe(403);
    });
  });
});
