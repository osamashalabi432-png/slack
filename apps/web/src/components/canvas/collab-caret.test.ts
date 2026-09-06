import { describe, test, expect } from "vitest";
import { colorFromId, renderCollabCaret } from "./collab-caret";

describe("colorFromId", () => {
  test("is deterministic per id", () => {
    expect(colorFromId("user-abc")).toBe(colorFromId("user-abc"));
  });

  test("differs across ids and is a valid hsl string", () => {
    expect(colorFromId("user-abc")).not.toBe(colorFromId("user-xyz"));
    expect(colorFromId("anything")).toMatch(/^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/);
  });
});

describe("renderCollabCaret", () => {
  test("builds a caret with a gutter avatar and a hover label", () => {
    const el = renderCollabCaret({ name: "Ada Lovelace", color: "#ff0000" });
    expect(el.classList.contains("collab-caret")).toBe(true);
    expect(el.style.getPropertyValue("--collab-color")).toBe("#ff0000");

    const avatar = el.querySelector<HTMLElement>(".collab-caret__avatar");
    expect(avatar).not.toBeNull();
    expect(avatar!.getAttribute("data-testid")).toBe("collab-caret-avatar");
    // No image → initial.
    expect(avatar!.textContent).toContain("A");

    const label = el.querySelector<HTMLElement>(".collab-caret__label");
    expect(label?.textContent).toBe("Ada Lovelace");
  });

  test("uses the avatar image when one is supplied", () => {
    const el = renderCollabCaret({
      name: "Bob",
      color: "#00f",
      avatarUrl: "https://cdn.example/bob.png",
    });
    const avatar = el.querySelector<HTMLElement>(".collab-caret__avatar")!;
    expect(avatar.style.backgroundImage).toContain("https://cdn.example/bob.png");
  });

  test("falls back to a placeholder name when none is given", () => {
    const el = renderCollabCaret({});
    expect(el.querySelector(".collab-caret__label")?.textContent).toBe("Someone");
  });
});
