import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "../../test-utils";
import { waitFor } from "@testing-library/react";
import type { FolderContent } from "@openslaq/shared";
import { useChannelFolderFiles } from "./useChannelFolderFiles";

const mockTabs = vi.fn<() => Array<{ id: string; type: string }>>();
const mockFetchCanvasContent = vi.fn<() => Promise<FolderContent>>();

vi.mock("../../state/chat-store", () => ({
  useChatStore: () => ({ state: { channelTabs: { "chan-1": mockTabs() } } }),
}));
// Must be referentially stable — the resolve effect lists it as a dependency.
const DEPS = {};
vi.mock("./useOperationDeps", () => ({ useOperationDeps: () => DEPS }));
vi.mock("../../gallery/gallery-context", () => ({ useGalleryMode: () => false }));
vi.mock("@openslaq/client-core", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, fetchCanvasContent: (...a: unknown[]) => mockFetchCanvasContent(...(a as [])) };
});

beforeEach(() => {
  mockTabs.mockReset();
  mockFetchCanvasContent.mockReset();
});
afterEach(cleanup);

describe("useChannelFolderFiles", () => {
  test("flattens folder-tab entries into @-menu items scoped by tab", async () => {
    mockTabs.mockReturnValue([
      { id: "tab-a", type: "folder" },
      { id: "tab-canvas", type: "canvas" },
    ]);
    mockFetchCanvasContent.mockResolvedValue({
      items: [
        { id: "att-1", kind: "file", name: "deck.pdf", url: "x", addedAt: "" },
        { id: "lnk-1", kind: "link", name: "Figma", url: "https://figma.com", addedAt: "" },
      ],
    });

    const { result } = renderHook(() => useChannelFolderFiles("acme", "chan-1"));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current).toEqual([
      { id: "file:tab-a:att-1", displayName: "deck.pdf", isFile: true, fileKind: "file" },
      { id: "file:tab-a:lnk-1", displayName: "Figma", isFile: true, fileKind: "link" },
    ]);
    // Only the folder tab was read.
    expect(mockFetchCanvasContent).toHaveBeenCalledTimes(1);
  });

  test("is empty when the channel has no folder tabs", async () => {
    mockTabs.mockReturnValue([{ id: "tab-canvas", type: "canvas" }]);
    const { result } = renderHook(() => useChannelFolderFiles("acme", "chan-1"));
    await waitFor(() => expect(result.current).toEqual([]));
    expect(mockFetchCanvasContent).not.toHaveBeenCalled();
  });

  test("is empty without a workspace/channel", async () => {
    mockTabs.mockReturnValue([{ id: "tab-a", type: "folder" }]);
    const { result } = renderHook(() => useChannelFolderFiles(undefined, undefined));
    await waitFor(() => expect(result.current).toEqual([]));
    expect(mockFetchCanvasContent).not.toHaveBeenCalled();
  });
});
