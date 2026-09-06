import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import type { FolderItem } from "@openslaq/shared";
import { FolderItemThumb } from "./FolderView";

function item(over: Partial<FolderItem>): FolderItem {
  return {
    id: "i1",
    kind: "file",
    name: "thing",
    url: "https://s3.example/thing",
    addedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

afterEach(cleanup);

describe("FolderItemThumb", () => {
  test("previews an image entry with its own URL", () => {
    render(<FolderItemThumb item={item({ mimeType: "image/png", name: "shot.png" })} />);
    const img = screen.getByTestId("folder-thumb-i1") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("https://s3.example/thing");
  });

  test("falls back to a glyph when the image fails to load", () => {
    render(<FolderItemThumb item={item({ mimeType: "image/png" })} />);
    fireEvent.error(screen.getByTestId("folder-thumb-i1"));
    expect(screen.queryByTestId("folder-thumb-i1")).toBeNull();
  });

  test("gives PDFs a taller, page-shaped frame (glyph until page 1 renders)", () => {
    const { container } = render(
      <FolderItemThumb item={item({ mimeType: "application/pdf", name: "doc.pdf" })} />,
    );
    // No worker in the test env, so the first-page render fails and we show the
    // glyph — but in the A4-ish frame.
    expect(screen.queryByTestId("folder-thumb-i1")).toBeNull();
    expect(container.querySelector(".h-14")).not.toBeNull();
  });

  test("detects a PDF by extension when the mime type is missing", () => {
    const { container } = render(
      <FolderItemThumb item={item({ mimeType: null, name: "Report Q3.PDF" })} />,
    );
    expect(container.querySelector(".h-14")).not.toBeNull();
  });

  test("uses a plain 36px glyph for other files", () => {
    const { container } = render(
      <FolderItemThumb item={item({ mimeType: "text/plain", name: "notes.txt" })} />,
    );
    expect(container.querySelector(".h-14")).toBeNull();
    expect(container.querySelector(".w-9.h-9")).not.toBeNull();
  });

  test("shows the site's favicon for a link, falling back to a glyph on error", () => {
    render(<FolderItemThumb item={item({ kind: "link", mimeType: null, url: "https://fortinet.com" })} />);
    const img = screen.getByTestId("folder-thumb-i1") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("s2/favicons?domain=fortinet.com");
    fireEvent.error(img);
    expect(screen.queryByTestId("folder-thumb-i1")).toBeNull();
  });

  test("uses a glyph for a link with an unparseable URL", () => {
    render(<FolderItemThumb item={item({ kind: "link", mimeType: null, url: "not a url" })} />);
    expect(screen.queryByTestId("folder-thumb-i1")).toBeNull();
  });
});
