import { describe, expect, it } from "bun:test";
import { filterMentionItems } from "./mention-helpers";
import type { MentionSuggestionItem } from "./MentionSuggestion";

const members: MentionSuggestionItem[] = [
  { id: "u1", displayName: "Alice Cooper" },
  { id: "u2", displayName: "Bob Marley" },
  { id: "u3", displayName: "Alicia Keys" },
];

describe("filterMentionItems", () => {
  it("includes matching group mentions and users", () => {
    const items = filterMentionItems("ali", members);
    expect(items.map((i) => i.id)).toEqual(["u1", "u3"]);

    const groupItems = filterMentionItems("here", members);
    expect(groupItems[0]?.id).toBe("here");
  });

  it("limits people to 10", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, displayName: `user${i}` }));
    const items = filterMentionItems("u", many);
    expect(items.length).toBe(10);
  });

  it("appends matching channel files below people", () => {
    const files: MentionSuggestionItem[] = [
      { id: "file:t1:a1", displayName: "alignment.pdf", isFile: true, fileKind: "file" },
      { id: "file:t1:l1", displayName: "spec link", isFile: true, fileKind: "link" },
    ];
    const items = filterMentionItems("ali", members, files);
    // People first, then the file whose name matches "ali".
    expect(items.map((i) => i.id)).toEqual(["u1", "u3", "file:t1:a1"]);
  });

  it("gives files their own budget even when people fill the page", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, displayName: `match${i}` }));
    const files: MentionSuggestionItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `file:t:${i}`,
      displayName: `match-file${i}`,
      isFile: true,
      fileKind: "file" as const,
    }));
    const items = filterMentionItems("match", many, files);
    // 10 people + 8 files.
    expect(items.length).toBe(18);
    expect(items[10]?.id).toBe("file:t:0");
    expect(items.every((i, idx) => (idx < 10 ? !i.isFile : i.isFile))).toBe(true);
  });
});
