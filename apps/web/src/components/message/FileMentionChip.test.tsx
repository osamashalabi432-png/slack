import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import type { FolderRef } from "@openslaq/shared";
import { FileMentionChip } from "./FileMentionChip";

const mockFetchFolderRef = vi.fn<() => Promise<FolderRef>>();

vi.mock("@openslaq/client-core", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, fetchFolderRef: (...args: unknown[]) => mockFetchFolderRef(...(args as [])) };
});

// A stable object — a fresh {} each render would re-fire the resolve effect.
const DEPS = {};
vi.mock("../../hooks/chat/useOperationDeps", () => ({
  useOperationDeps: () => DEPS,
}));

const SCOPED = { workspaceSlug: "acme", channelId: "chan-1", tabId: "tab-1", itemId: "item-1" };

beforeEach(() => {
  mockFetchFolderRef.mockReset();
  mockFetchFolderRef.mockResolvedValue({ name: "file.txt", kind: "file", downloadUrl: "https://s3/default" });
});
afterEach(cleanup);

describe("FileMentionChip", () => {
  test("resolves and shows the file name", async () => {
    mockFetchFolderRef.mockResolvedValue({ name: "roadmap.pdf", kind: "file", downloadUrl: "https://s3/x" });
    render(<FileMentionChip {...SCOPED} />);
    expect(await screen.findByText("roadmap.pdf")).toBeDefined();
    expect(mockFetchFolderRef).toHaveBeenCalledWith({}, SCOPED);
  });

  test("clicking a file re-resolves a fresh URL and triggers a download", async () => {
    mockFetchFolderRef.mockResolvedValue({ name: "roadmap.pdf", kind: "file", downloadUrl: "https://s3/fresh" });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<FileMentionChip {...SCOPED} />);
    const chip = await screen.findByTestId("file-mention");
    mockFetchFolderRef.mockClear();
    chip.click();

    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
    // One extra call on click, for a non-stale link.
    expect(mockFetchFolderRef).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  test("clicking a link opens it in a new tab instead of downloading", async () => {
    mockFetchFolderRef.mockResolvedValue({ name: "Spec", kind: "link", downloadUrl: "https://docs.example.com" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<FileMentionChip {...SCOPED} />);
    const chip = await screen.findByTestId("file-mention");
    chip.click();

    await vi.waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith("https://docs.example.com", "_blank", "noopener,noreferrer"),
    );
    openSpy.mockRestore();
  });

  test("shows an unavailable state when resolution fails", async () => {
    mockFetchFolderRef.mockRejectedValue(new Error("404"));
    render(<FileMentionChip {...SCOPED} />);
    expect(await screen.findByText("File unavailable")).toBeDefined();
  });

  test("is inert (no fetch) when shown outside its channel", () => {
    render(<FileMentionChip tabId="tab-1" itemId="item-1" />);
    expect(screen.getByText("File")).toBeDefined();
    expect(screen.getByTestId("file-mention").tagName).toBe("SPAN");
    expect(mockFetchFolderRef).not.toHaveBeenCalled();
  });
});
