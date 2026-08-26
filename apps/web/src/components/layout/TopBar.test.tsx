import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { TooltipProvider } from "../ui";

const navigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}));

import { TopBar } from "./TopBar";

const defaultProps = {
  workspaceName: "Acme Corp",
  onOpenSearch: () => {},
  onToggleSidebar: () => {},
  onSelectOutboxView: () => {},
};

function renderTopBar(props: Partial<typeof defaultProps> = {}) {
  return render(
    <TooltipProvider>
      <TopBar {...defaultProps} {...props} />
    </TooltipProvider>,
  );
}

describe("TopBar", () => {
  afterEach(() => {
    cleanup();
    navigate.mockClear();
  });

  test("labels the search control with the workspace name", () => {
    renderTopBar();
    expect(screen.getByTestId("search-trigger").textContent).toContain("Search Acme Corp");
  });

  test("opens search when the search control is clicked", () => {
    const onOpenSearch = vi.fn();
    renderTopBar({ onOpenSearch });
    screen.getByTestId("search-trigger").click();
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  test("toggles the sidebar", () => {
    const onToggleSidebar = vi.fn();
    renderTopBar({ onToggleSidebar });
    screen.getByTestId("toggle-sidebar-button").click();
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  test("navigates through history", () => {
    renderTopBar();
    screen.getByLabelText("Go back").click();
    expect(navigate).toHaveBeenCalledWith(-1);

    screen.getByLabelText("Go forward").click();
    expect(navigate).toHaveBeenCalledWith(1);
  });

  test("opens the outbox view from the history control", () => {
    const onSelectOutboxView = vi.fn();
    renderTopBar({ onSelectOutboxView });
    screen.getByLabelText("Drafts and sent").click();
    expect(onSelectOutboxView).toHaveBeenCalledOnce();
  });
});
