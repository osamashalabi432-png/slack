import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { TooltipProvider } from "../ui";
import type { WorkspaceInfo } from "../../state/chat-store";

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
}));
vi.mock("../../gallery/gallery-context", () => ({
  useGalleryMode: () => false,
}));
vi.mock("../user/CustomUserButton", () => ({
  CustomUserButton: () => null,
}));

import { WorkspaceRail, type RailView } from "./WorkspaceRail";

const workspaces = [
  {
    id: "ws-1",
    slug: "acme",
    name: "Acme Corp",
    role: "owner" as const,
    createdAt: "2026-01-01T00:00:00Z",
    memberCount: 3,
  },
] as WorkspaceInfo[];

const defaultProps = {
  workspaces,
  workspaceSlug: "acme",
  activeView: "channel" as RailView,
  unreadTotal: 0,
  canManage: false,
  onSelectHome: () => {},
  onSelectComposeView: () => {},
  onSelectUnreadsView: () => {},
  onSelectFilesView: () => {},
  onSelectSavedView: () => {},
  onSelectOutboxView: () => {},
  onOpenInvite: () => {},
  onOpenWorkspaceSettings: () => {},
};

function renderRail(props: Partial<typeof defaultProps> = {}) {
  return render(
    <TooltipProvider>
      <WorkspaceRail {...defaultProps} {...props} />
    </TooltipProvider>,
  );
}

describe("WorkspaceRail", () => {
  afterEach(cleanup);

  test("renders the primary navigation entries", () => {
    renderRail();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("DMs")).toBeTruthy();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByText("Files")).toBeTruthy();
    expect(screen.getByText("More")).toBeTruthy();
  });

  test("shows workspace initials in the switcher", () => {
    renderRail();
    expect(screen.getByTestId("rail-workspace-button").textContent).toBe("AC");
  });

  test("hides Admin unless the user can manage the workspace", () => {
    renderRail();
    expect(screen.queryByTestId("admin-rail-link")).toBeNull();

    cleanup();
    renderRail({ canManage: true });
    expect(screen.getByTestId("admin-rail-link")).toBeTruthy();
  });

  test("shows an unread badge on Activity and caps it at 99+", () => {
    renderRail({ unreadTotal: 7 });
    expect(screen.getByTestId("unreads-view-link").textContent).toContain("7");

    cleanup();
    renderRail({ unreadTotal: 250 });
    expect(screen.getByTestId("unreads-view-link").textContent).toContain("99+");
  });

  test("omits the badge when there is nothing unread", () => {
    renderRail({ unreadTotal: 0 });
    expect(screen.getByTestId("unreads-view-link").textContent).toBe("Activity");
  });

  test("fires navigation callbacks", () => {
    const onSelectUnreadsView = vi.fn();
    const onSelectFilesView = vi.fn();
    renderRail({ onSelectUnreadsView, onSelectFilesView });

    screen.getByTestId("unreads-view-link").click();
    expect(onSelectUnreadsView).toHaveBeenCalledOnce();

    screen.getByTestId("files-view-link").click();
    expect(onSelectFilesView).toHaveBeenCalledOnce();
  });

  test("marks the active view", () => {
    renderRail({ activeView: "files" });
    const files = screen.getByTestId("files-view-link");
    expect(files.querySelector(".bg-rail-active")).toBeTruthy();

    const home = screen.getByTestId("home-view-link");
    expect(home.querySelector(".bg-rail-active")).toBeNull();
  });
});
