/** A stable, readable colour for a user id (same everywhere they appear). */
export function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue} 68% 52%)`;
}

/**
 * The DOM for a remote editor's caret: a coloured bar at their cursor plus a
 * small round avatar pinned in the left gutter of that line, name on hover.
 * Passed to `CollaborationCaret`'s `render` option.
 */
export function renderCollabCaret(user: Record<string, unknown>): HTMLElement {
  const color = typeof user.color === "string" && user.color ? user.color : "#1264a3";
  const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : "Someone";
  const avatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : "";

  const caret = document.createElement("span");
  caret.className = "collab-caret";
  caret.style.setProperty("--collab-color", color);

  const avatar = document.createElement("span");
  avatar.className = "collab-caret__avatar";
  avatar.setAttribute("data-testid", "collab-caret-avatar");
  if (avatarUrl) {
    avatar.style.backgroundImage = `url("${avatarUrl.replace(/"/g, "%22")}")`;
  } else {
    avatar.textContent = name.charAt(0).toUpperCase();
  }

  const label = document.createElement("span");
  label.className = "collab-caret__label";
  label.textContent = name;
  avatar.appendChild(label);

  caret.appendChild(avatar);
  return caret;
}
