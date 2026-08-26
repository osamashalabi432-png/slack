/**
 * Local UI verification helper — not part of the real suite.
 * Exercises canvas databases, block dragging and folder tabs, and captures
 * screenshots for review. Delete when UI work is done.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { expect, type Page } from "@playwright/test";

const OUT = SHOT_DIR;

async function openChannel(page: Page, slug: string) {
  await page.addInitScript(() => {
    localStorage.setItem("openslaq-theme", "dark");
    localStorage.removeItem("openslaq-sidebar-collapse");
  });
  await setupMockAuth(page);
  await page.goto(`/w/${slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
}

test("canvas database: board, table and calendar", async ({ page, testWorkspace }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("canvas-editor")).toBeVisible();

  await page.getByTestId("canvas-editor").click();
  await page.keyboard.type("Team plan");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/database");
  await expect(page.getByTestId("canvas-block-database")).toBeVisible();
  await page.getByTestId("canvas-block-database").click();

  await expect(page.getByTestId("db-board")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("db-board-add-not-started").click();
  await expect(page.locator('[data-testid^="db-card-"]')).toHaveCount(1, { timeout: 10_000 });
  await page.getByTestId("db-board-add-in-progress").click();
  await expect(page.locator('[data-testid^="db-card-"]')).toHaveCount(2, { timeout: 10_000 });
  await page.screenshot({ path: `${OUT}/db-board.png` });

  // Table view: inline rename.
  await page.getByTestId("db-view-table").click();
  await expect(page.getByTestId("db-table")).toBeVisible();
  const titleCell = page.locator('[data-testid^="db-row-"]').first().locator('[data-testid$="-title"]');
  await titleCell.fill("Ship the database block");
  await titleCell.blur();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/db-table.png` });

  // Calendar view must render a full month, not a clipped strip.
  await page.getByTestId("db-view-calendar").click();
  await expect(page.getByTestId("db-calendar")).toBeVisible();
  const gridHeight = await page.getByTestId("db-calendar").evaluate((el) => {
    const grid = el.querySelector(".grid") as HTMLElement | null;
    return grid?.getBoundingClientRect().height ?? 0;
  });
  expect(gridHeight).toBeGreaterThan(400);
  await page.screenshot({ path: `${OUT}/db-calendar.png` });

  // Rows live outside the document, so they survive a reload.
  await page.reload();
  await page.getByText("# general").click();
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Canvas" }).first().click();
  await expect(page.getByTestId("db-board")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("db-board")).toContainText("Ship the database block");
});

test("calendar can be inserted on its own, without a database", async ({ page, testWorkspace }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("canvas-editor")).toBeVisible();

  await page.getByTestId("canvas-editor").click();
  await page.keyboard.type("/calendar");

  // Each view type is offered as its own block.
  await expect(page.getByTestId("canvas-block-calendar")).toBeVisible();
  await page.getByTestId("canvas-block-calendar").click();

  // It renders straight into a calendar, with no view switcher to wade through.
  await expect(page.getByTestId("db-calendar")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("db-board")).toHaveCount(0);
  await expect(page.getByTestId("db-view-board")).toHaveCount(0);
  await expect(page.getByTestId("db-view-calendar")).toBeHidden();

  // Adding an entry on a specific day works.
  const dayCells = page.locator('[data-testid^="db-calendar-day-"]');
  const target = dayCells.nth(15);
  const dayKey = await target.getAttribute("data-testid");
  await target.hover();
  await page.locator(`[data-testid="${dayKey!.replace("db-calendar-day-", "db-calendar-add-")}"]`).click();
  await expect(page.locator('[data-testid^="db-calendar-row-"]')).toHaveCount(1, { timeout: 10_000 });

  await page.screenshot({ path: `${OUT}/standalone-calendar.png` });

  // Board and table are separately insertable too. Click the trailing
  // paragraph directly — clicking the editor root lands unpredictably when an
  // atom node view is the last block.
  await page.locator(".canvas-doc > p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.type("/board");
  await expect(page.getByTestId("canvas-block-board")).toBeVisible();
  await page.getByTestId("canvas-block-board").click();
  await expect(page.getByTestId("db-board")).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: `${OUT}/standalone-blocks.png` });

  // Both survive a reload.
  await page.reload();
  await page.getByText("# general").click();
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Canvas" }).first().click();
  await expect(page.getByTestId("db-calendar")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("db-board")).toBeVisible();
});

test("canvas blocks can be dragged to reorder", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("canvas-editor")).toBeVisible();

  const editor = page.getByTestId("canvas-editor");
  await editor.click();
  await page.keyboard.type("First paragraph");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second paragraph");

  // Hovering a block reveals its drag handle.
  await page.locator(".canvas-doc p").first().hover();
  await expect(page.getByTestId("canvas-drag-handle")).toBeVisible();
  await page.screenshot({ path: `${OUT}/drag-handle.png` });
});

test("folder tab accepts uploads and links", async ({ page, testWorkspace }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);

  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-folder").click();
  await expect(page.getByTestId("folder-view")).toBeVisible();
  await page.screenshot({ path: `${OUT}/folder-empty.png` });

  // Upload through the hidden input (same path the drop handler uses).
  await page.getByTestId("folder-file-input").setInputFiles({
    name: "runbook.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("deploy steps go here"),
  });
  await expect(page.locator('[data-testid^="folder-item-"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId("folder-view")).toContainText("runbook.txt");

  // Add a link.
  await page.getByTestId("folder-add-button").first().click();
  await page.getByTestId("folder-add-link").click();
  await page.getByTestId("folder-link-url").fill("https://docs.example.com/runbook");
  await page.getByTestId("folder-link-name").fill("Runbook docs");
  await page.getByTestId("folder-link-submit").click();
  await expect(page.locator('[data-testid^="folder-item-"]')).toHaveCount(2, { timeout: 10_000 });
  await page.screenshot({ path: `${OUT}/folder-items.png` });

  // Contents persist across a reload.
  await page.reload();
  await page.getByText("# general").click();
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Folder" }).first().click();
  await expect(page.getByTestId("folder-view")).toContainText("runbook.txt");
  await expect(page.getByTestId("folder-view")).toContainText("Runbook docs");
});
