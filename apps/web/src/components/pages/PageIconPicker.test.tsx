import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent } from "@testing-library/react";
import { createRef, type RefObject } from "react";

let captured: ((emoji: { native?: string }) => void) | null = null;

vi.mock("@emoji-mart/react", () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (emoji: { native?: string }) => void }) => {
    captured = onEmojiSelect;
    return <div data-testid="mock-emoji-picker" />;
  },
}));
vi.mock("@emoji-mart/data", () => ({ default: {} }));
vi.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ resolved: "dark" }) }));

import { PageIconPicker } from "./PageIconPicker";

function anchor(): RefObject<HTMLElement | null> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  el.getBoundingClientRect = () =>
    ({ top: 100, bottom: 140, left: 50, right: 100, width: 50, height: 40, x: 50, y: 100, toJSON: () => {} }) as DOMRect;
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement }).current = el;
  return ref;
}

afterEach(() => {
  cleanup();
  captured = null;
  document.body.innerHTML = "";
});

describe("PageIconPicker", () => {
  test("emits the picked native emoji", () => {
    const onSelect = vi.fn();
    render(
      <PageIconPicker anchorRef={anchor()} onSelect={onSelect} onRemove={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("page-icon-picker")).toBeDefined();
    captured?.({ native: "🚀" });
    expect(onSelect).toHaveBeenCalledWith("🚀");
  });

  test("ignores a selection without a native glyph (e.g. a custom emoji)", () => {
    const onSelect = vi.fn();
    render(
      <PageIconPicker anchorRef={anchor()} onSelect={onSelect} onRemove={vi.fn()} onClose={vi.fn()} />,
    );
    captured?.({});
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("has a Remove icon action", () => {
    const onRemove = vi.fn();
    render(
      <PageIconPicker anchorRef={anchor()} onSelect={vi.fn()} onRemove={onRemove} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("page-icon-clear"));
    expect(onRemove).toHaveBeenCalled();
  });

  test("closes on an outside click", () => {
    const onClose = vi.fn();
    const { container } = render(
      <PageIconPicker anchorRef={anchor()} onSelect={vi.fn()} onRemove={vi.fn()} onClose={onClose} />,
    );
    // The backdrop is the first fixed inset-0 element.
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalled();
    void container;
  });
});
