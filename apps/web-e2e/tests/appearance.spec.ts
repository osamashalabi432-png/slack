/**
 * Sidebar themes: picking one has to repaint the real chrome, not just store a
 * preference, and it has to survive a reload.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { expect, type Page } from "@playwright/test";

const OUT = SHOT_DIR;

/** Jade, from the theme catalogue. */
const JADE_SIDEBAR = "rgb(20, 96, 73)";

async function openAppearance(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("openslaq:open-settings")));
  await page.getByRole("button", { name: "Appearance" }).click();
}

async function sidebarColor(page: Page) {
  return page
    .getByTestId("sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test("a sidebar theme repaints the chrome and sticks", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await expect(page.getByTestId("sidebar")).toBeVisible();

  // Selecting a channel draws a rounded pill, not a full-bleed rectangle.
  await page.getByText("# general").click();
  const rowRadius = await page
    .getByRole("button", { name: /# general/ })
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(rowRadius).not.toBe("0px");

  // The sidebar is a card on the chrome, not a flush column.
  const radius = await page
    .getByTestId("sidebar")
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).not.toBe("0px");

  const before = await sidebarColor(page);

  await openAppearance(page);
  await expect(page.getByTestId("color-mode-system")).toBeVisible();
  await page.screenshot({ path: `${OUT}/appearance-settings.png` });
  await page.getByTestId("chrome-theme-jade").click();

  await expect
    .poll(() => sidebarColor(page))
    .toBe(JADE_SIDEBAR);
  expect(before).not.toBe(JADE_SIDEBAR);

  // The previews are miniatures of the app, so their message area has to
  // follow the colour mode rather than being baked in.
  await page.getByTestId("color-mode-dark").click();
  await expect(page.getByTestId("theme-preview-jade")).toBeVisible();
  await page.screenshot({ path: `${OUT}/appearance-dark.png` });
  await page.getByTestId("color-mode-light").click();

  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/theme-jade.png` });

  // The choice is remembered, not just applied to the live DOM.
  await page.reload();
  await expect(page.getByTestId("sidebar")).toBeVisible();
  await expect.poll(() => sidebarColor(page)).toBe(JADE_SIDEBAR);
});
