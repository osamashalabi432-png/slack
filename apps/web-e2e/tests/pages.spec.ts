/**
 * Pages, reached the only way they are reached now: a channel's canvas tab is
 * a page, and "/page" nests more inside it.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { expect, type Page } from "@playwright/test";

const OUT = SHOT_DIR;

// These walk through several create-and-reload round trips, which does not fit
// the suite default of 20s.
test.describe.configure({ timeout: 60_000 });

/** Opens a channel and adds a canvas tab, landing on its page. */
async function openCanvasPage(page: Page, slug: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("channel-tab-add").click();
  await page.getByTestId("channel-tab-add-canvas").click();
  await expect(page.getByTestId("page-view")).toBeVisible({ timeout: 20_000 });
}

/** Creates a sub-page from the body with "/page" and opens it. */
async function addSubPage(page: Page) {
  const body = page.locator(".tiptap").first();
  await body.click();
  await body.pressSequentially("/page");
  await expect(page.getByTestId("canvas-slash-menu")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("canvas-block-page").click();
  const link = page.locator('[data-testid^="page-link-"]').last();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
}

test("pages nest and breadcrumbs walk back up", async ({ page, testWorkspace }) => {
  await openCanvasPage(page, testWorkspace.slug);
  await page.getByTestId("page-title-input").fill("Handbook");

  await addSubPage(page);
  await page.getByTestId("page-title-input").fill("Engineering");

  await addSubPage(page);
  await page.getByTestId("page-title-input").fill("Onboarding");

  // Two levels down, the trail shows both ancestors.
  const crumbs = page.getByTestId("page-breadcrumbs");
  await expect(crumbs).toContainText("Handbook");
  await expect(crumbs).toContainText("Engineering");
  await page.screenshot({ path: `${OUT}/page-view.png` });

  // Clicking the first crumb goes all the way back to the tab's own page.
  await crumbs.locator("button").first().click();
  await expect(page.getByTestId("page-title-input")).toHaveValue("Handbook", { timeout: 10_000 });
});

test("an icon set on a page shows on the link pointing at it", async ({ page, testWorkspace }) => {
  await openCanvasPage(page, testWorkspace.slug);
  await page.getByTestId("page-title-input").fill("Parent");

  await addSubPage(page);
  await page.getByTestId("page-title-input").fill("Child");
  await page.getByTestId("page-icon-button").click();
  const picker = page.getByTestId("page-icon-picker");
  await expect(picker).toBeVisible();
  await picker.locator("input").fill("rocket");
  await picker.locator('button[aria-label*="rocket" i]').first().click();

  await page.getByTestId("page-breadcrumbs").locator("button").first().click();
  await expect(page.getByTestId("page-title-input")).toHaveValue("Parent", { timeout: 10_000 });

  // The body stores only the id, so the link picks up both the name and icon.
  const link = page.locator('[data-testid^="page-link-"]').first();
  await expect(link).toContainText("Child");
  await expect(link).toContainText("🚀");
});

test("starring a page, and archiving one that has children", async ({ page, testWorkspace }) => {
  await openCanvasPage(page, testWorkspace.slug);
  await page.getByTestId("page-title-input").fill("Roadmap");

  await addSubPage(page);
  await page.getByTestId("page-title-input").fill("Q3");
  await page.getByTestId("page-favourite").click();
  await expect(page.getByTestId("page-favourite")).toBeVisible();

  // Archiving the child returns to the tab's page rather than leaving the tab
  // showing something that is no longer there.
  await page.getByTestId("page-archive").click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByTestId("page-title-input")).toHaveValue("Roadmap", { timeout: 10_000 });
});
