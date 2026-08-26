import { describe, test, expect } from "vitest";
import { buildPageTree } from "../pages";
import type { Page, PageId } from "@openslaq/shared";

function makePage(id: string, parentId: string | null, position = 0, createdAt = "2026-01-01"): Page {
  return {
    id: id as PageId,
    workspaceId: "w1",
    parentId: (parentId as PageId | null) ?? null,
    title: id,
    icon: null,
    coverUrl: null,
    position,
    restrictedToGroupId: null,
    archived: false,
    hasChildren: false,
    isFavourite: false,
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("buildPageTree", () => {
  test("nests pages under their parent, to any depth", () => {
    const tree = buildPageTree([
      makePage("root", null),
      makePage("child", "root"),
      makePage("grandchild", "child"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe("root" as PageId);
    expect(tree[0]!.children[0]!.id).toBe("child" as PageId);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe("grandchild" as PageId);
  });

  test("orders siblings by position, then by age", () => {
    const tree = buildPageTree([
      makePage("second", null, 1),
      makePage("first", null, 0),
      makePage("older", null, 1, "2025-01-01"),
    ]);

    expect(tree.map((p) => p.id)).toEqual(["first", "older", "second"] as PageId[]);
  });

  test("orders children too, not just the roots", () => {
    const tree = buildPageTree([
      makePage("root", null),
      makePage("b", "root", 1),
      makePage("a", "root", 0),
    ]);

    expect(tree[0]!.children.map((c) => c.id)).toEqual(["a", "b"] as PageId[]);
  });

  test("a page whose parent is hidden surfaces at the root rather than vanishing", () => {
    // The API omits pages the viewer cannot read; a visible child of a hidden
    // parent must still be reachable.
    const tree = buildPageTree([makePage("orphan", "restricted-parent")]);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe("orphan" as PageId);
  });

  test("copes with an empty workspace", () => {
    expect(buildPageTree([])).toEqual([]);
  });
});
