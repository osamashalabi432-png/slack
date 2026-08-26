/**
 * Local UI verification helper — not part of the real suite.
 * Exercises the folder item context menu. Delete when UI work is done.
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

async function addFolder(page: Page, name?: string) {
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-folder").click();
  // Wait for the *new* folder to finish loading. Asserting only that a
  // folder view is visible passes instantly on the outgoing tab, which
  // lets a following upload target the wrong folder.
  await expect(page.getByTestId("folder-view")).toContainText(
    "Add files and links to reference later",
    { timeout: 10_000 },
  );
  if (name) {
    const tab = page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Folder" }).last();
    await tab.dblclick();
    const input = page.locator('[data-testid^="channel-tab-rename-input-"]');
    await input.fill(name);
    await input.press("Enter");
    // Let the rename land before touching the tab strip again, otherwise the
    // next click races the re-render.
    await expect(page.locator('[data-testid^="channel-tab-"]').filter({ hasText: name })).toHaveCount(
      1,
      { timeout: 10_000 },
    );
  }
}

test("folder item menu exposes the full option set", async ({ page, testWorkspace }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);
  await addFolder(page);

  await page.getByTestId("folder-file-input").setInputFiles({
    name: "runbook.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("deploy steps"),
  });
  const item = page.locator('[data-testid^="folder-item-"]').first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  const itemId = (await item.getAttribute("data-testid"))!.replace("folder-item-", "");

  // Open the overflow menu.
  await item.hover();
  await page.getByTestId(`folder-menu-${itemId}`).click();

  await expect(page.getByTestId(`folder-save-${itemId}`)).toContainText("Save for later");
  await expect(page.getByTestId(`folder-open-${itemId}`)).toContainText("Open");
  await expect(page.getByTestId(`folder-details-${itemId}`)).toContainText("View file details");
  await expect(page.getByTestId(`folder-copy-${itemId}`)).toContainText("Copy link to file");
  await expect(page.getByTestId(`folder-edit-${itemId}`)).toContainText("Edit file details");
  await expect(page.getByTestId(`folder-remove-${itemId}`)).toContainText("Remove file");
  await page.screenshot({ path: `${OUT}/folder-menu.png` });

  // Open submenu reveals its entries.
  await page.getByTestId(`folder-open-${itemId}`).hover();
  await expect(page.getByTestId(`folder-open-tab-${itemId}`)).toBeVisible();
  await expect(page.getByTestId(`folder-download-${itemId}`)).toBeVisible();

  // Save for later marks the entry.
  await page.getByTestId(`folder-save-${itemId}`).click();
  await expect(page.getByTestId(`folder-saved-${itemId}`)).toBeVisible({ timeout: 10_000 });

  // File details dialog.
  await item.hover();
  await page.getByTestId(`folder-menu-${itemId}`).click();
  await page.getByTestId(`folder-details-${itemId}`).click();
  await expect(page.getByTestId("folder-details-dialog")).toContainText("runbook.txt");
  await page.screenshot({ path: `${OUT}/folder-details.png` });
  await page.getByRole("button", { name: "Done" }).click();

  // Rename through Edit file details.
  await item.hover();
  await page.getByTestId(`folder-menu-${itemId}`).click();
  await page.getByTestId(`folder-edit-${itemId}`).click();
  await page.getByTestId("folder-edit-name").fill("Deployment runbook");
  await page.getByTestId("folder-edit-save").click();
  await expect(page.getByTestId("folder-view")).toContainText("Deployment runbook");

  // The rename and the Later mark both survive a reload.
  await page.reload();
  await page.getByText("# general").click();
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Folder" }).first().click();
  await expect(page.getByTestId("folder-view")).toContainText("Deployment runbook");
  await expect(page.getByTestId(`folder-saved-${itemId}`)).toBeVisible({ timeout: 10_000 });
});

test("items move between folders and saved files reach the Later view", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await openChannel(page, testWorkspace.slug);

  await addFolder(page, "Archive");
  await addFolder(page);

  await page.getByTestId("folder-file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("some notes"),
  });
  const item = page.locator('[data-testid^="folder-item-"]').first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  const itemId = (await item.getAttribute("data-testid"))!.replace("folder-item-", "");

  // Save it, so it should appear in Later.
  await item.hover();
  await page.getByTestId(`folder-menu-${itemId}`).click();
  await page.getByTestId(`folder-save-${itemId}`).click();
  await expect(page.getByTestId(`folder-saved-${itemId}`)).toBeVisible({ timeout: 10_000 });

  // It reaches the Later view straight away.
  await page.getByTestId("rail-more-button").click();
  await page.getByTestId("saved-view-link").click();
  await expect(page.getByTestId("saved-files-section")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("saved-files-section")).toContainText("notes.txt");
  await page.screenshot({ path: `${OUT}/later-files.png` });

  // Back to the folder, then move the entry into Archive.
  await page.getByTestId("home-view-link").click();
  await page.getByText("# general").click();
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Folder" }).first().click();
  await expect(page.getByTestId("folder-view")).toContainText("notes.txt", { timeout: 10_000 });

  const moved = page.locator(`[data-testid="folder-item-${itemId}"]`);
  await moved.hover();
  await page.getByTestId(`folder-menu-${itemId}`).click();
  await page.getByTestId(`folder-move-${itemId}`).hover();
  const moveTarget = page.locator('[data-testid^="folder-move-to-"]').first();
  await expect(moveTarget).toBeVisible({ timeout: 10_000 });
  await moveTarget.hover();
  await moveTarget.click();
  await expect(moved).toHaveCount(0, { timeout: 10_000 });

  // It now lives in the Archive folder.
  await page.locator('[data-testid^="channel-tab-"]').filter({ hasText: "Archive" }).first().click();
  await expect(page.getByTestId("folder-view")).toContainText("notes.txt", { timeout: 10_000 });

  // The Later mark follows the entry rather than dangling on the old folder.
  await page.getByTestId("rail-more-button").click();
  await page.getByTestId("saved-view-link").click();
  await expect(page.getByTestId("saved-files-section")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("saved-files-section")).toContainText("notes.txt");
  await expect(page.getByTestId("saved-files-section")).toContainText("Archive");
});
