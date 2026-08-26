/**
 * Images dropped into a page body. They are ordinary attachments carrying the
 * page they belong to, which is what lets everyone who can read the page see
 * them — and keeps them from anyone who cannot.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import {
  createTestClient,
  createTestWorkspace,
  addToWorkspace,
  getBaseUrl,
  testId,
  type TestApiClient,
} from "./helpers/api-client";

const PNG = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });

async function uploadInto(headers: HeadersInit, pageId?: string) {
  const form = new FormData();
  form.append("files", PNG);
  if (pageId) form.append("pageId", pageId);
  const res = await fetch(`${getBaseUrl()}/api/uploads`, { method: "POST", headers, body: form });
  const body = (await res.json()) as { attachments?: { id: string; downloadUrl: string }[] };
  return { status: res.status, attachment: body.attachments?.[0] };
}

async function urlFor(headers: HeadersInit, attachmentId: string) {
  const res = await fetch(`${getBaseUrl()}/api/uploads/${attachmentId}/url`, { headers });
  const body = (await res.json()) as { downloadUrl?: string };
  return { status: res.status, downloadUrl: body.downloadUrl };
}

describe("images in a page", () => {
  let admin: TestApiClient;
  let adminHeaders: Record<string, string>;
  let member: TestApiClient;
  let memberHeaders: Record<string, string>;
  let outsiderHeaders: Record<string, string>;
  let slug: string;

  async function newPage(title: string, client = admin) {
    const res = await client.api.workspaces[":slug"].pages.$post({
      param: { slug },
      json: { title, parentId: null },
    });
    return (await res.json()) as { id: string };
  }

  beforeAll(async () => {
    const ownerCtx = await createTestClient();
    admin = ownerCtx.client;
    adminHeaders = ownerCtx.headers;
    slug = (await createTestWorkspace(admin)).slug;

    const memberCtx = await createTestClient({
      id: `page-image-member-${testId()}`,
      email: `page-image-member-${testId()}@example.com`,
      displayName: "Page Image Member",
    });
    member = memberCtx.client;
    memberHeaders = memberCtx.headers;
    await addToWorkspace(admin, slug, member);

    const outsiderCtx = await createTestClient({
      id: `page-image-outsider-${testId()}`,
      email: `page-image-outsider-${testId()}@example.com`,
      displayName: "Page Image Outsider",
    });
    outsiderHeaders = outsiderCtx.headers;
  });

  test("an image uploaded into a page can be fetched again by its id", async () => {
    const page = await newPage("With a picture");
    const { status, attachment } = await uploadInto(adminHeaders, page.id);
    expect(status).toBe(201);

    // Signed URLs expire, so the page keeps the id and asks for a fresh one.
    const fresh = await urlFor(adminHeaders, attachment!.id);
    expect(fresh.status).toBe(200);
    expect(fresh.downloadUrl).toBeTruthy();
  });

  test("everyone who can read the page can see its images", async () => {
    const page = await newPage("Shared");
    const { attachment } = await uploadInto(adminHeaders, page.id);

    // The image was uploaded by someone else, and never posted as a message.
    const asMember = await urlFor(memberHeaders, attachment!.id);
    expect(asMember.status).toBe(200);
    expect(asMember.downloadUrl).toBeTruthy();
  });

  test("someone outside the workspace cannot", async () => {
    const page = await newPage("Private to the workspace");
    const { attachment } = await uploadInto(adminHeaders, page.id);

    const asOutsider = await urlFor(outsiderHeaders, attachment!.id);
    expect(asOutsider.status).toBe(404);
  });

  test("an image cannot be filed against a page you cannot read", async () => {
    const page = await newPage("Not yours");
    const { status } = await uploadInto(outsiderHeaders, page.id);
    expect(status).toBe(403);
  });

  test("a file with no page behind it stays private to whoever uploaded it", async () => {
    const { attachment } = await uploadInto(adminHeaders);
    expect((await urlFor(adminHeaders, attachment!.id)).status).toBe(200);
    expect((await urlFor(memberHeaders, attachment!.id)).status).toBe(404);
  });
});
