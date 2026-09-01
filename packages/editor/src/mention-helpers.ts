import type { MentionSuggestionItem } from "./MentionSuggestion";

export const GROUP_MENTIONS: MentionSuggestionItem[] = [
  { id: "here", displayName: "@here — notify online members", isGroup: true },
  { id: "channel", displayName: "@channel — notify all members", isGroup: true },
];

export function filterMentionItems(
  query: string,
  members: MentionSuggestionItem[],
  files: MentionSuggestionItem[] = [],
): MentionSuggestionItem[] {
  const q = query.toLowerCase();

  const groups = GROUP_MENTIONS.filter((g) =>
    g.id.toLowerCase().startsWith(q) || g.displayName.toLowerCase().includes(q),
  );

  const users = members.filter((m) => m.displayName.toLowerCase().includes(q));

  // Files sit below people (so an @name still lands on a person first) and get
  // their own budget, so a crowded people list never hides every file.
  const fileMatches = files.filter((f) => f.displayName.toLowerCase().includes(q));

  return [...[...groups, ...users].slice(0, 10), ...fileMatches.slice(0, 8)];
}
