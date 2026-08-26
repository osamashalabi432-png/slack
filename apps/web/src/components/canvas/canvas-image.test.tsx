import { describe, test, expect, vi } from "vitest";
import { imageFilesFrom } from "./CanvasEditor";
import { imageBlockItem } from "./canvas-slash-menu";
import type { Editor, Range } from "@tiptap/core";

/** A DataTransfer stand-in: jsdom's constructor cannot carry files. */
function transferWith(files: File[]): DataTransfer {
  return { files } as unknown as DataTransfer;
}

const png = new File(["x"], "shot.png", { type: "image/png" });
const doc = new File(["x"], "notes.txt", { type: "text/plain" });

describe("imageFilesFrom", () => {
  test("keeps images and drops everything else", () => {
    expect(imageFilesFrom(transferWith([png, doc]))).toEqual([png]);
  });

  test("is empty when there is nothing to read", () => {
    expect(imageFilesFrom(null)).toEqual([]);
    expect(imageFilesFrom(transferWith([doc]))).toEqual([]);
  });
});

describe("imageBlockItem", () => {
  test("clears the typed /image before opening the picker", () => {
    const onInsertImage = vi.fn();
    const run = vi.fn();
    const deleteRange = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ deleteRange }));
    const editor = { chain: () => ({ focus }) } as unknown as Editor;
    const range = { from: 0, to: 6 } as Range;

    const item = imageBlockItem(onInsertImage);
    item.run(editor, range);

    expect(deleteRange).toHaveBeenCalledWith(range);
    expect(run).toHaveBeenCalledOnce();
    expect(onInsertImage).toHaveBeenCalledOnce();
  });

  test("is offered under the names people reach for", () => {
    const item = imageBlockItem(() => {});
    expect(item.keywords).toContain("image");
    expect(item.keywords).toContain("screenshot");
  });
});
