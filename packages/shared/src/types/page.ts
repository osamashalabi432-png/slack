import type { CanvasContent } from "./tab";
import type { PageId, UserGroupId, UserId } from "./ids";

/**
 * A page in the workspace tree. Pages nest inside pages without limit, which
 * is the whole shape of Notion: a document is also a container.
 */
export interface Page {
  id: PageId;
  workspaceId: string;
  parentId: PageId | null;
  title: string;
  /** An emoji, or a URL for an uploaded icon. */
  icon: string | null;
  coverUrl: string | null;
  position: number;
  /** Null means the page follows its parent; a root page then means everyone. */
  restrictedToGroupId: UserGroupId | null;
  archived: boolean;
  /** Whether this page has children, so the tree knows to show a twisty. */
  hasChildren: boolean;
  isFavourite: boolean;
  createdBy: UserId | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageWithContent extends Page {
  content: CanvasContent | null;
}

/** One step of the trail from the root down to the open page. */
export interface PageCrumb {
  id: PageId;
  title: string;
  icon: string | null;
}

/** A page plus the trail above it, which is what the header renders. */
export interface PageDetail extends PageWithContent {
  breadcrumbs: PageCrumb[];
}

export const UNTITLED_PAGE = "Untitled";

/** What to show when a page has no title yet — Notion shows "Untitled". */
export function pageTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNTITLED_PAGE;
}
