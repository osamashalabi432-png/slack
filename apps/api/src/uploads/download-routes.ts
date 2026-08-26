import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../auth/middleware";
import { BEARER_SECURITY, jsonContent } from "../lib/openapi-helpers";
import { canAccessAttachment, getAttachmentById, getDownloadUrl } from "./service";
import { rlRead } from "../rate-limit";
import { errorSchema } from "../openapi/schemas";
import { redirectResponse } from "../openapi/responses";
import { NotFoundError } from "../errors";

const downloadRoute = createRoute({
  method: "get",
  path: "/uploads/:id/download",
  tags: ["Uploads"],
  summary: "Download file",
  description: "Redirects to a pre-signed download URL for the attachment.",
  security: BEARER_SECURITY,
  middleware: [auth, rlRead] as const,
  request: {
    params: z.object({ id: z.string().describe("Attachment ID") }),
  },
  responses: {
    302: { description: "Redirect to download URL" },
    401: jsonContent(errorSchema, "Unauthorized"),
    404: jsonContent(errorSchema, "Attachment not found"),
  },
});

/**
 * Pre-signed URLs expire within the hour, so anything that keeps a reference to
 * a file — a page body holding an image, say — stores the attachment id and
 * asks for a fresh URL when it needs to show it.
 */
const urlRoute = createRoute({
  method: "get",
  path: "/uploads/:id/url",
  tags: ["Uploads"],
  summary: "Get a download URL",
  description: "Returns a freshly signed download URL for the attachment.",
  security: BEARER_SECURITY,
  middleware: [auth, rlRead] as const,
  request: {
    params: z.object({ id: z.string().describe("Attachment ID") }),
  },
  responses: {
    200: jsonContent(z.object({ downloadUrl: z.string() }), "A signed download URL"),
    401: jsonContent(errorSchema, "Unauthorized"),
    404: jsonContent(errorSchema, "Attachment not found"),
  },
});

const app = new OpenAPIHono().openapi(downloadRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const attachment = await getAttachmentById(id);

  if (!attachment) {
    throw new NotFoundError("Attachment");
  }

  const canAccess = await canAccessAttachment(attachment, user.id);
  if (!canAccess) {
    throw new NotFoundError("Attachment");
  }

  const url = getDownloadUrl(attachment.storageKey);
  return redirectResponse(c, url, 302);
}).openapi(urlRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const attachment = await getAttachmentById(id);
  if (!attachment) throw new NotFoundError("Attachment");
  if (!(await canAccessAttachment(attachment, user.id))) throw new NotFoundError("Attachment");

  return c.json({ downloadUrl: getDownloadUrl(attachment.storageKey) }, 200);
});

export default app;
