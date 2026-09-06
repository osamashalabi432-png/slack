import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useTheme } from "../../theme/ThemeProvider";

interface PageIconPickerProps {
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (emoji: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

const WIDTH = 352;
const HEIGHT = 460;
const MARGIN = 8;

/**
 * The page-icon chooser: a full emoji-mart picker (categories, search,
 * frequently used, preview, skin tone) plus a "Remove icon" row. Portalled and
 * flipped/clamped to stay on screen.
 */
export function PageIconPicker({ anchorRef, onSelect, onRemove, onClose }: PageIconPickerProps) {
  const { resolved } = useTheme();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + HEIGHT > window.innerHeight - MARGIN) top = Math.max(MARGIN, rect.top - HEIGHT - 6);
    if (left + WIDTH > window.innerWidth - MARGIN) left = window.innerWidth - WIDTH - MARGIN;
    if (left < MARGIN) left = MARGIN;
    setPos({ top, left });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onMouseDown={onClose} />
      <div
        data-testid="page-icon-picker"
        className="fixed z-[100] overflow-hidden rounded-lg border border-border-default bg-surface shadow-xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <Picker
          data={data}
          theme={resolved}
          onEmojiSelect={(e: { native?: string }) => {
            if (e.native) onSelect(e.native);
          }}
          previewPosition="bottom"
          skinTonePosition="preview"
        />
        <button
          type="button"
          data-testid="page-icon-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          className="w-full cursor-pointer border-t border-border-default bg-transparent px-3 py-2 text-left text-xs text-muted hover:bg-surface-hover hover:text-primary"
        >
          Remove icon
        </button>
      </div>
    </>,
    document.body,
  );
}
