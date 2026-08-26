import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { pages, pageFavourites } from "./schema";
import { userGroupMembers } from "../groups/schema";
import { channelMembers, channels } from "../channels/schema";
import { workspaceMembers } from "../workspaces/schema";
import { channelTabs } from "../channels/tab-schema";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import type { CanvasContent, Page, PageCrumb, PageDetail, PageId, UserId } from "@openslaq/shared";
import { asPageId, asUserGroupId, asUserId, pageTitle } from "@openslaq/shared";

/** How deep a page can sit. Guards against a cycle turning into an infinite walk. */
const MAX_DEPTH = 50;

type PageRow = typeof pages.$inferSelect;

function toPage(row: PageRow, hasChildren: boolean, isFavourite: boolean): Page {
  return {
    id: asPageId(row.id),
    workspaceId: row.workspaceId,
    parentId: row.parentId ? asPageId(row.parentId) : null,
    title: row.title,
    icon: row.icon,
    coverUrl: row.coverUrl,
    position: row.position,
    restrictedToGroupId: row.restrictedToGroupId ? asUserGroupId(row.restrictedToGroupId) : null,
    archived: row.archived,
    hasChildren,
    isFavourite,
    createdBy: row.createdBy ? asUserId(row.createdBy) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requirePage(workspaceId: string, pageId: PageId): Promise<PageRow> {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("Page");
  return row;
}

/**
 * The trail from the root down to this page, plus the group restriction that
 * applies. A page inherits its restriction from the nearest ancestor that has
 * one, so moving a page under a restricted parent tightens it automatically.
 */
async function walkUp(
  row: PageRow,
): Promise<{ trail: PageRow[]; restriction: string | null; channelId: string | null }> {
  const trail: PageRow[] = [row];
  let restriction = row.restrictedToGroupId;
  let channelId = row.channelId;
  let cursor = row;

  for (let depth = 0; cursor.parentId && depth < MAX_DEPTH; depth++) {
    const [parent] = await db.select().from(pages).where(eq(pages.id, cursor.parentId)).limit(1);
    if (!parent) break;
    trail.unshift(parent);
    restriction ??= parent.restrictedToGroupId;
    channelId ??= parent.channelId;
    cursor = parent;
  }

  return { trail, restriction, channelId };
}

async function isChannelMember(userId: UserId, channelId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: channelMembers.userId })
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
    .limit(1);
  return !!row;
}

async function isInGroup(userId: UserId, groupId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: userGroupMembers.userId })
    .from(userGroupMembers)
    .where(and(eq(userGroupMembers.groupId, groupId), eq(userGroupMembers.userId, userId)))
    .limit(1);
  return !!row;
}

/**
 * Reading a page means being allowed everywhere above it too — otherwise a
 * restricted parent could be sidestepped by linking straight to its child.
 */
async function assertCanRead(row: PageRow, viewerId: UserId): Promise<PageRow[]> {
  const { trail, restriction, channelId } = await walkUp(row);
  // A channel's page belongs to that channel, so a private channel's canvas
  // stays private no matter that pages are otherwise workspace-wide.
  if (channelId && !(await isChannelMember(viewerId, channelId))) {
    throw new ForbiddenError("This page belongs to a channel you are not in");
  }
  if (restriction && !(await isInGroup(viewerId, restriction))) {
    throw new ForbiddenError("This page is restricted to a user group you are not in");
  }
  return trail;
}

/** Channel pages whose channel the viewer is not in. */
async function blockedChannelPageIds(workspaceId: string, viewerId: UserId): Promise<string[]> {
  const rows = await db
    .select({ id: pages.id, channelId: pages.channelId })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), sql`${pages.channelId} is not null`));
  if (rows.length === 0) return [];

  const mine = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.userId, viewerId));
  const joined = new Set(mine.map((m) => m.channelId));
  return rows.filter((r) => !joined.has(r.channelId!)).map((r) => r.id);
}

/** Ids of every page the viewer may not read, so listings can skip them. */
async function hiddenPageIds(workspaceId: string, viewerId: UserId): Promise<Set<string>> {
  const restricted = await db
    .select({ id: pages.id, groupId: pages.restrictedToGroupId })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), sql`${pages.restrictedToGroupId} is not null`));

  const groupIds = [...new Set(restricted.map((r) => r.groupId!))];
  const mine = await db
    .select({ groupId: userGroupMembers.groupId })
    .from(userGroupMembers)
    .where(
      and(inArray(userGroupMembers.groupId, groupIds), eq(userGroupMembers.userId, viewerId)),
    );
  const allowed = new Set(mine.map((m) => m.groupId));

  const blockedRoots = restricted.filter((r) => !allowed.has(r.groupId!)).map((r) => r.id);
  blockedRoots.push(...(await blockedChannelPageIds(workspaceId, viewerId)));
  // A blocked page hides everything beneath it as well.
  if (blockedRoots.length === 0) return new Set();

  const all = await db
    .select({ id: pages.id, parentId: pages.parentId })
    .from(pages)
    .where(eq(pages.workspaceId, workspaceId));
  const childrenOf = new Map<string, string[]>();
  for (const row of all) {
    if (!row.parentId) continue;
    childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row.id]);
  }

  const hidden = new Set<string>();
  const stack = [...blockedRoots];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (hidden.has(id)) continue;
    hidden.add(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return hidden;
}

/**
 * The whole tree the viewer can see, flat. The sidebar builds the nesting
 * itself; sending it flat keeps one round trip and lets the client expand
 * without asking again.
 */
/**
 * Whether the viewer may read this page. Anything hanging off a page — an image
 * in its body, say — answers its own access question with this.
 */
export async function canReadPage(pageId: PageId, viewerId: UserId): Promise<boolean> {
  const [row] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  if (!row) return false;

  // Everything else here is scoped inside a workspace the caller already
  // belongs to; this is reached from outside that check, so it makes it.
  const [membership] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, viewerId)),
    )
    .limit(1);
  if (!membership) return false;
  try {
    await assertCanRead(row, viewerId);
    return true;
  } catch {
    return false;
  }
}

export async function listPages(workspaceId: string, viewerId: UserId): Promise<Page[]> {
  const [rows, favourites, hidden] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.archived, false)))
      .orderBy(asc(pages.position), asc(pages.createdAt)),
    db
      .select({ pageId: pageFavourites.pageId })
      .from(pageFavourites)
      .where(eq(pageFavourites.userId, viewerId)),
    hiddenPageIds(workspaceId, viewerId),
  ]);

  const favourited = new Set(favourites.map((f) => f.pageId));
  const parents = new Set(rows.map((r) => r.parentId).filter(Boolean) as string[]);

  return rows
    .filter((row) => !hidden.has(row.id))
    .map((row) => toPage(row, parents.has(row.id), favourited.has(row.id)));
}

export async function getPage(
  workspaceId: string,
  pageId: PageId,
  viewerId: UserId,
): Promise<PageDetail> {
  const row = await requirePage(workspaceId, pageId);
  const trail = await assertCanRead(row, viewerId);

  const [children, favourite] = await Promise.all([
    db.select({ id: pages.id }).from(pages).where(eq(pages.parentId, pageId)).limit(1),
    db
      .select({ pageId: pageFavourites.pageId })
      .from(pageFavourites)
      .where(and(eq(pageFavourites.pageId, pageId), eq(pageFavourites.userId, viewerId)))
      .limit(1),
  ]);

  const breadcrumbs: PageCrumb[] = trail.slice(0, -1).map((crumb) => ({
    id: asPageId(crumb.id),
    title: pageTitle(crumb.title),
    icon: crumb.icon,
  }));

  return {
    ...toPage(row, children.length > 0, favourite.length > 0),
    content: row.content ?? null,
    breadcrumbs,
  };
}

export async function createPage(
  workspaceId: string,
  createdBy: UserId,
  input: { parentId?: PageId | null; title?: string; icon?: string | null },
): Promise<Page> {
  if (input.parentId) {
    const parent = await requirePage(workspaceId, input.parentId);
    await assertCanRead(parent, createdBy);
  }

  const [nextRow] = await db
    .select({ next: sql<number>`coalesce(max(${pages.position}), -1) + 1` })
    .from(pages)
    .where(
      and(
        eq(pages.workspaceId, workspaceId),
        input.parentId ? eq(pages.parentId, input.parentId) : isNull(pages.parentId),
      ),
    );

  const [row] = await db
    .insert(pages)
    .values({
      workspaceId,
      parentId: input.parentId ?? null,
      title: input.title?.trim() || "Untitled",
      icon: input.icon ?? null,
      position: nextRow?.next ?? 0,
      createdBy,
      updatedBy: createdBy,
    })
    .returning();

  return toPage(row!, false, false);
}

export async function updatePage(
  workspaceId: string,
  pageId: PageId,
  userId: UserId,
  input: {
    title?: string;
    icon?: string | null;
    coverUrl?: string | null;
    content?: CanvasContent;
    restrictedToGroupId?: string | null;
  },
): Promise<void> {
  const row = await requirePage(workspaceId, pageId);
  await assertCanRead(row, userId);

  const patch: Partial<typeof pages.$inferInsert> = { updatedAt: new Date(), updatedBy: userId };
  if (input.title !== undefined) patch.title = input.title.trim() || "Untitled";
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.coverUrl !== undefined) patch.coverUrl = input.coverUrl;
  if (input.content !== undefined) patch.content = input.content;
  if (input.restrictedToGroupId !== undefined) {
    patch.restrictedToGroupId = input.restrictedToGroupId;
  }

  await db.update(pages).set(patch).where(eq(pages.id, pageId));
}

/**
 * Moving a page carries its whole subtree. The guard is the interesting part:
 * a page cannot be dropped inside its own descendant, which would detach the
 * branch from the tree and lose it.
 */
export async function movePage(
  workspaceId: string,
  pageId: PageId,
  userId: UserId,
  input: { parentId: PageId | null; position?: number },
): Promise<void> {
  const row = await requirePage(workspaceId, pageId);
  await assertCanRead(row, userId);

  if (input.parentId) {
    if (input.parentId === pageId) throw new BadRequestError("A page cannot contain itself");
    const target = await requirePage(workspaceId, input.parentId);
    await assertCanRead(target, userId);

    const { trail } = await walkUp(target);
    if (trail.some((ancestor) => ancestor.id === pageId)) {
      throw new BadRequestError("A page cannot be moved inside one of its own sub-pages");
    }
  }

  const position =
    input.position ??
    (
      await db
        .select({ next: sql<number>`coalesce(max(${pages.position}), -1) + 1` })
        .from(pages)
        .where(
          and(
            eq(pages.workspaceId, workspaceId),
            input.parentId ? eq(pages.parentId, input.parentId) : isNull(pages.parentId),
          ),
        )
    )[0]!.next;

  await db
    .update(pages)
    .set({ parentId: input.parentId, position, updatedAt: new Date(), updatedBy: userId })
    .where(eq(pages.id, pageId));
}

/**
 * Archiving hides the page and everything under it rather than deleting, so a
 * mis-click never destroys a branch of work.
 */
export async function archivePage(
  workspaceId: string,
  pageId: PageId,
  userId: UserId,
  archived: boolean,
): Promise<void> {
  const row = await requirePage(workspaceId, pageId);
  await assertCanRead(row, userId);

  const ids = [pageId as string];
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const children = await db
      .select({ id: pages.id })
      .from(pages)
      .where(inArray(pages.parentId, ids));
    const fresh = children.map((c) => c.id).filter((id) => !ids.includes(id));
    if (fresh.length === 0) break;
    ids.push(...fresh);
  }

  await db
    .update(pages)
    .set({ archived, updatedAt: new Date(), updatedBy: userId })
    .where(inArray(pages.id, ids));
}

export async function setFavourite(
  workspaceId: string,
  pageId: PageId,
  userId: UserId,
  favourite: boolean,
): Promise<void> {
  const row = await requirePage(workspaceId, pageId);
  await assertCanRead(row, userId);

  if (favourite) {
    await db.insert(pageFavourites).values({ pageId, userId }).onConflictDoNothing();
  } else {
    await db
      .delete(pageFavourites)
      .where(and(eq(pageFavourites.pageId, pageId), eq(pageFavourites.userId, userId)));
  }
}

/**
 * The page behind a channel's canvas tab, created on first use.
 *
 * Canvas tabs used to keep their body in `channel_tabs.content`. That column is
 * carried over into the page the first time the tab is opened, so existing
 * canvases keep their contents and nothing needs a data migration.
 */
export async function ensureTabPage(
  workspaceId: string,
  channelId: string,
  tabId: string,
  userId: UserId,
): Promise<PageId> {
  // The tab row is locked for the whole check-then-create: two clients opening
  // the tab at the same moment would otherwise each mint a page, and whichever
  // lost the race would be edited but never linked — its content lost on the
  // next load.
  return await db.transaction(async (tx) => {
    const [tab] = await tx
      .select()
      .from(channelTabs)
      .where(and(eq(channelTabs.id, tabId), eq(channelTabs.channelId, channelId)))
      .for("update")
      .limit(1);
    if (!tab) throw new NotFoundError("Tab");

    if (tab.pageId) {
      const existing = await requirePage(workspaceId, asPageId(tab.pageId));
      await assertCanRead(existing, userId);
      return asPageId(existing.id);
    }

    const [channel] = await tx
      .select({ workspaceId: channels.workspaceId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    if (!channel || channel.workspaceId !== workspaceId) throw new NotFoundError("Channel");
    if (!(await isChannelMember(userId, channelId))) {
      throw new ForbiddenError("This page belongs to a channel you are not in");
    }

    const [row] = await tx
      .insert(pages)
      .values({
        workspaceId,
        channelId,
        title: tab.name,
        content: tab.content ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await tx.update(channelTabs).set({ pageId: row!.id }).where(eq(channelTabs.id, tabId));
    return asPageId(row!.id);
  });
}
