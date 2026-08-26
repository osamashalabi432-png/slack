/**
 * The directory and its three sections, and the rule underneath them: a user
 * group owns private channels, and being in the group is what grants access.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { expect } from "@playwright/test";

const OUT = SHOT_DIR;

test("the directory lists people, channels and groups, and a group can be created", async ({
  page,
  testWorkspace,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await expect(page.getByTestId("sidebar")).toBeVisible();

  await page.getByTestId("directories-nav-button").click();
  await expect(page.getByTestId("directory-view")).toBeVisible();

  // People
  await expect(page.getByTestId("directory-tab-people")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("directory-person-e2e-test-user-001")).toBeVisible();
  await page.screenshot({ path: `${OUT}/directory-people.png` });

  // Channels
  await page.getByTestId("directory-tab-channels").click();
  await expect(page.locator("[data-testid^=directory-channel-]").first()).toBeVisible();

  // Dark mode is where the row separators were invisible. The theme provider
  // writes its variables inline, so the stored choice has to be set and the
  // page reloaded rather than just toggling a class.
  await page.evaluate(() => localStorage.setItem("openslaq-theme", "dark"));
  await page.reload();
  await page.getByTestId("directories-nav-button").click();
  await page.getByTestId("directory-tab-channels").click();
  const channelRow = page.locator("[data-testid^=directory-channel-]").first();
  await expect(channelRow).toBeVisible();

  // Rows are raised cards: on a near-black surface a 1px hairline reads as
  // nothing, and the last row in a list had no rule at all.
  const look = await channelRow.evaluate((el) => {
    const style = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return {
      border: style.borderBottomColor,
      background: style.backgroundColor,
      surface: root.getPropertyValue("--surface").trim().toLowerCase(),
    };
  });

  const toRgb = (value: string) => value.match(/\d+/g)!.map(Number) as number[];
  const [br, bg, bb] = toRgb(look.background);
  // The card fill has to actually differ from the page behind it.
  expect(br! + bg! + bb!).toBeGreaterThan(0);
  expect(look.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(look.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(look.surface).toBe("#1a1d21");

  await page.screenshot({ path: `${OUT}/directory-dark.png` });
  await expect(page.getByText("general", { exact: false }).first()).toBeVisible();

  // Groups — empty until we make one.
  await page.getByTestId("directory-tab-groups").click();
  await expect(page.getByTestId("directory-groups-empty")).toBeVisible();
  await page.screenshot({ path: `${OUT}/directory-groups.png` });

  await page.getByTestId("directory-action").click();
  await page.getByTestId("group-name-input").fill("Marketing Team");
  // The handle is derived from the name.
  await expect(page.getByTestId("group-handle-input")).toHaveValue("marketing-team");
  await page.getByTestId("group-purpose-input").fill("this is for marketing purposes");

  // Taking a public channel warns that it becomes private.
  const generalCheckbox = page.locator('[data-testid^="group-channel-"]').first();
  await generalCheckbox.check();
  await expect(page.getByTestId("group-privacy-warning")).toBeVisible();
  await page.screenshot({ path: `${OUT}/directory-create-group.png` });

  await page.screenshot({ path: `${OUT}/directory-dialog-padded.png` });
  await page.getByTestId("group-create-submit").click();

  const row = page.locator('[data-testid^="directory-group-"]').first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Marketing Team");
  await expect(row).toContainText("@marketing-team");
  await expect(row).toContainText("1 channel");

  const groupLook = await row.evaluate((el) => {
    const style = getComputedStyle(el);
    return { border: style.borderBottomColor, background: style.backgroundColor };
  });
  expect(groupLook.background).toBe(look.background);
  expect(groupLook.border).not.toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: `${OUT}/directory-groups-dark.png` });
});

test("a new group reaches the sidebar without a reload", async ({ page, testWorkspace }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByTestId("directories-nav-button").click();
  await page.getByTestId("directory-tab-groups").click();
  await page.getByTestId("directory-action").click();

  await page.getByTestId("group-name-input").fill("Marketing Team");
  await page.locator('[data-testid^="group-channel-"]').first().check();
  await page.getByTestId("group-create-submit").click();

  // The directory list updates straight away.
  const row = page.locator('[data-testid^="directory-group-"]').first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // The sidebar heading only covers groups you belong to, so join it — still
  // without reloading anything.
  await row.click();
  await page.getByText("Add people").click();
  await page.locator('[data-testid^="group-add-member-"]').first().click();
  await expect(page.getByTestId("group-members")).toContainText("Test User");
  await page.getByRole("button", { name: "Close" }).click();

  const section = page.locator('[data-testid^="group-sidebar-section-"]');
  await expect(section).toBeVisible({ timeout: 10_000 });
  await expect(section).toContainText("Marketing Team");
});
