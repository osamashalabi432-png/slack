import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import { TooltipProvider } from "../ui";
import type { ChannelTab, ChannelId, ChannelTabId, UserId } from "@openslaq/shared";

import { ChannelTabs } from "./ChannelTabs";

function makeTab(id: string, name: string, position: number): ChannelTab {
  return {
    id: id as ChannelTabId,
    channelId: "ch-1" as ChannelId,
    type: "canvas",
    name,
    position,
    createdBy: "user-1" as UserId,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: null,
  };
}

const defaultProps = {
  tabs: [] as ChannelTab[],
  activeTabId: null as string | null,
  onSelectTab: () => {},
  onCreateTab: () => {},
  onRenameTab: () => {},
  onDeleteTab: () => {},
  canManage: true,
};

function renderTabs(props: Partial<typeof defaultProps> = {}) {
  return render(
    <TooltipProvider>
      <ChannelTabs {...defaultProps} {...props} />
    </TooltipProvider>,
  );
}

describe("ChannelTabs", () => {
  afterEach(cleanup);

  test("always renders the Messages tab", () => {
    renderTabs();
    expect(screen.getByTestId("channel-tab-messages")).toBeTruthy();
  });

  test("renders canvas tabs from state", () => {
    renderTabs({ tabs: [makeTab("t-1", "Project plan", 0), makeTab("t-2", "Retro", 1)] });
    expect(screen.getByTestId("channel-tab-t-1").textContent).toContain("Project plan");
    expect(screen.getByTestId("channel-tab-t-2").textContent).toContain("Retro");
  });

  test("selecting a tab reports its id, and Messages reports null", () => {
    const onSelectTab = vi.fn();
    renderTabs({ tabs: [makeTab("t-1", "Project plan", 0)], onSelectTab });

    fireEvent.click(screen.getByTestId("channel-tab-t-1"));
    expect(onSelectTab).toHaveBeenCalledWith("t-1");

    fireEvent.click(screen.getByTestId("channel-tab-messages"));
    expect(onSelectTab).toHaveBeenCalledWith(null);
  });

  test("only the open tab exposes its options menu", () => {
    renderTabs({ tabs: [makeTab("t-1", "A", 0), makeTab("t-2", "B", 1)], activeTabId: "t-1" });
    expect(screen.getByTestId("channel-tab-menu-t-1")).toBeTruthy();
    expect(screen.queryByTestId("channel-tab-menu-t-2")).toBeNull();
  });

  test("hides tab management for archived channels", () => {
    renderTabs({ tabs: [makeTab("t-1", "A", 0)], activeTabId: "t-1", canManage: false });
    expect(screen.queryByTestId("channel-tab-add")).toBeNull();
    expect(screen.queryByTestId("channel-tab-menu-t-1")).toBeNull();
  });

  test("double-clicking a tab starts an inline rename that commits on Enter", () => {
    const onRenameTab = vi.fn();
    renderTabs({ tabs: [makeTab("t-1", "Old name", 0)], onRenameTab });

    fireEvent.doubleClick(screen.getByTestId("channel-tab-t-1"));
    const input = screen.getByTestId("channel-tab-rename-input-t-1");
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameTab).toHaveBeenCalledWith("t-1", "New name");
  });

  test("escape cancels a rename without saving", () => {
    const onRenameTab = vi.fn();
    renderTabs({ tabs: [makeTab("t-1", "Old name", 0)], onRenameTab });

    fireEvent.doubleClick(screen.getByTestId("channel-tab-t-1"));
    const input = screen.getByTestId("channel-tab-rename-input-t-1");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRenameTab).not.toHaveBeenCalled();
  });

  test("an unchanged rename does not call the handler", () => {
    const onRenameTab = vi.fn();
    renderTabs({ tabs: [makeTab("t-1", "Same", 0)], onRenameTab });

    fireEvent.doubleClick(screen.getByTestId("channel-tab-t-1"));
    fireEvent.keyDown(screen.getByTestId("channel-tab-rename-input-t-1"), { key: "Enter" });

    expect(onRenameTab).not.toHaveBeenCalled();
  });

  test("the add menu offers both tab types", async () => {
    const onCreateTab = vi.fn();
    renderTabs({ onCreateTab });

    fireEvent.pointerDown(
      screen.getByTestId("channel-tab-add"),
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    );

    const folderItem = await screen.findByTestId("channel-tab-add-folder");
    expect(screen.getByTestId("channel-tab-add-canvas")).toBeTruthy();

    fireEvent.click(folderItem);
    expect(onCreateTab).toHaveBeenCalledWith("folder");
  });

  test("folder tabs render with a folder icon", () => {
    const folderTab = { ...makeTab("t-9", "Assets", 0), type: "folder" as const };
    renderTabs({ tabs: [folderTab] });
    expect(screen.getByTestId("channel-tab-t-9").textContent).toContain("Assets");
  });

  test("does not render a Files tab", () => {
    renderTabs({ tabs: [makeTab("t-1", "Canvas", 0)] });
    expect(screen.queryByTestId("channel-tab-files")).toBeNull();
    expect(screen.getByTestId("channel-tabs").textContent).not.toContain("Files");
  });
});
