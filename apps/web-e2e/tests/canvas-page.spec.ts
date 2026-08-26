/**
 * A channel's canvas tab is a page now: same title, icon and body, with
 * "/page" nesting sub-pages inline and breadcrumbs to come back up. The old
 * flat canvas is gone, and there is no page tree in the sidebar. Images paste
 * straight into the body.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { expect } from "@playwright/test";

const OUT = SHOT_DIR;

test.describe.configure({ timeout: 60_000 });

test("a canvas tab opens as a page and nests sub-pages inline", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();

  // The sidebar no longer carries a page tree.
  await expect(page.getByTestId("page-tree")).toHaveCount(0);

  // Add a canvas tab.
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();

  // It comes up as a page, not the old canvas.
  await expect(page.getByTestId("page-view")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("page-title-input")).toBeVisible();

  const body = page.locator(".tiptap").first();
  await body.click();
  await body.pressSequentially("/page");
  await expect(page.getByTestId("canvas-slash-menu")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("canvas-block-page").click();

  const link = page.locator('[data-testid^="page-link-"]').first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${OUT}/canvas-as-page.png` });

  // Opening the sub-page keeps you inside the tab, with a way back.
  await link.click();
  await page.getByTestId("page-title-input").fill("Runbook");
  await expect(page.getByTestId("page-breadcrumbs")).toBeVisible();
  await page.getByTestId("page-breadcrumbs").locator("button").first().click();

  // Back on the tab's own page, and the link carries the new name.
  await expect(page.locator('[data-testid^="page-link-"]').first()).toContainText("Runbook", {
    timeout: 10_000,
  });
});

test("database blocks still work inside a canvas page", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("page-view")).toBeVisible({ timeout: 20_000 });

  // The data blocks are still offered, and they render rather than throwing —
  // they read their channel from the tab's context.
  const body = page.locator(".tiptap").first();
  await body.click();
  await body.pressSequentially("/table");
  await expect(page.getByTestId("canvas-slash-menu")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("canvas-block-table").click();

  await expect(page.locator('[data-testid^="db-block-"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("page-error")).toHaveCount(0);
});

test("an image pasted into the body becomes a block in the page", async ({
  page,
  testWorkspace,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("page-view")).toBeVisible({ timeout: 20_000 });

  const body = page.locator(".tiptap").first();
  await body.click();
  await body.pressSequentially("Before the picture");

  // Paste an image the way a screenshot arrives: files on the clipboard.
  await body.evaluate((el) => {
    // A 1x1 PNG, small enough to inline.
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      ),
      (c) => c.charCodeAt(0),
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "shot.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true }));
  });

  // The placeholder gives way to the uploaded image, sitting under the text.
  const image = page.getByTestId("canvas-image");
  await expect(image).toBeVisible({ timeout: 20_000 });
  await expect(body).toContainText("Before the picture");
  await page.screenshot({ path: `${OUT}/canvas-image.png` });

  // It is part of the document, so it survives a reload. A reload lands back on
  // the messages tab, so the canvas has to be reopened.
  await expect(page.locator("[data-save-state=\"saved\"]")).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await page.getByText("# general").click();
  await page.getByRole("button", { name: "Canvas" }).click();
  await expect(page.getByTestId("page-view")).toBeVisible({ timeout: 20_000 });
  const reloaded = page.getByTestId("canvas-image");
  await expect(reloaded).toBeVisible({ timeout: 20_000 });

  // The body stores the attachment id, not the signed URL — those expire — so
  // the picture is looked up again each time the page is opened.
  await expect(reloaded).toHaveAttribute("data-attachment-id", /.+/);
});
