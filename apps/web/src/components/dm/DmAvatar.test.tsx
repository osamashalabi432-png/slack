import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { DmAvatar } from "./DmAvatar";

describe("DmAvatar", () => {
  afterEach(cleanup);

  test("shows the person's picture when they have one", () => {
    render(
      <DmAvatar
        userId="u1"
        displayName="Osama Nader"
        avatarUrl="https://example.com/a.png"
        online
      />,
    );

    const img = screen.getByTestId("dm-avatar-u1").querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
  });

  test("falls back to an initial rather than an empty square", () => {
    render(<DmAvatar userId="u2" displayName="grace hopper" avatarUrl={null} online={false} />);

    const tile = screen.getByTestId("dm-avatar-u2");
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.textContent).toBe("g");
  });

  test("keeps the presence dot, tinted by whether they are around", () => {
    const { unmount } = render(
      <DmAvatar userId="u3" displayName="Ada" avatarUrl={null} online />,
    );
    expect(screen.getByTestId("presence-u3").className).toContain("bg-green-500");
    expect(screen.getByTestId("presence-u3").getAttribute("aria-label")).toBe("Online");
    unmount();

    render(<DmAvatar userId="u4" displayName="Ada" avatarUrl={null} online={false} />);
    expect(screen.getByTestId("presence-u4").className).toContain("bg-gray-500");
    expect(screen.getByTestId("presence-u4").getAttribute("aria-label")).toBe("Away");
  });

  test("copes with a blank display name", () => {
    render(<DmAvatar userId="u5" displayName="   " avatarUrl={null} online={false} />);
    expect(screen.getByTestId("dm-avatar-u5").textContent).toBe("?");
  });
});
