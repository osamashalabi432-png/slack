/**
 * Huddles: two accounts joining the same room and seeing each other. Covers the
 * LiveKit media path, which only works when the RTC ports are published 1:1 and
 * the server advertises a host-reachable node IP.
 */
import { isolatedTest as test } from "./fixtures";
import { setupMockAuth } from "./helpers/mock-auth";
import { SHOT_DIR } from "./helpers/screenshots";
import { createApi, SECOND_USER } from "./helpers/api";
import { expect, type Page } from "@playwright/test";

const OUT = SHOT_DIR;

// Both tests sign in as the same account and the API allows one huddle per
// user, so they must not overlap in the parallel run.
test.describe.configure({ mode: "serial" });

// Synthetic mic/camera so both browsers can actually publish media.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--auto-select-desktop-capture-source=Entire screen",
    ],
  },
});

// ApiUser uses `userId`; setupMockAuth wants `id`. Mapping it wrong signs a
// token for the wrong account.
const MOCK_B = {
  id: SECOND_USER.userId,
  displayName: SECOND_USER.displayName,
  email: SECOND_USER.email,
  emailVerified: true,
};

/**
 * The control bar used to be pushed past the bottom of the docked panel by a
 * hard-coded 100vh room wrapper, so assert it actually sits inside the dock.
 */
async function expectControlsInsideDock(page: Page) {
  const dock = await page.getByTestId("huddle-dock").boundingBox();
  const bar = await page.getByTestId("huddle-leave").boundingBox();
  expect(dock).toBeTruthy();
  expect(bar).toBeTruthy();
  await expect(page.getByTestId("huddle-leave")).toBeVisible();
  await expect(page.getByTestId("huddle-mute-toggle")).toBeVisible();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(dock!.y + dock!.height);
}

/**
 * Hanging up is not done until the server says so — a leave still in flight
 * makes the next test's join fail with "already in a huddle".
 */
async function hangUp(page: Page) {
  const left = page.waitForResponse(
    (res) => res.url().includes("/huddle/leave") && res.request().method() === "POST",
  );
  await page.getByTestId("huddle-leave").click();
  await left;
}

function watch(page: Page, tag: string) {
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${tag}] ERROR:`, m.text().slice(0, 200));
  });
}

test("two accounts can hold a call", async ({ page, browser, testWorkspace }) => {
  const general = await testWorkspace.api.getChannelByName("general");
  expect(general).toBeTruthy();
  const channelId = general!.id;

  // Put the second account in the workspace and the channel — a huddle
  // requires channel membership.
  const invite = await testWorkspace.api.createInvite();
  const apiB = createApi(SECOND_USER, testWorkspace.slug);
  await apiB.acceptInvite(invite.code);
  await apiB.joinChannel(channelId);

  // Participant A (workspace owner).
  await page.setViewportSize({ width: 700, height: 800 });
  watch(page, "A");
  await setupMockAuth(page);
  await page.goto(`/huddle/${channelId}?name=general`);

  // Participant B in its own context.
  const ctxB = await browser.newContext({
    viewport: { width: 700, height: 800 },
    permissions: ["microphone", "camera"],
  });
  const pageB = await ctxB.newPage();
  watch(pageB, "B");
  await setupMockAuth(pageB, MOCK_B);
  await pageB.goto(`/huddle/${channelId}?name=general`);

  // Neither hits the ICE failure.
  for (const p of [page, pageB]) {
    await expect(p.getByText(/Could not connect to voice server/i)).toHaveCount(0);
    await expect(p.getByText(/Not a channel member/i)).toHaveCount(0);
  }

  // Both reach a connected room.
  await expect(page.getByTestId("video-grid")).toBeVisible({ timeout: 30_000 });
  await expect(pageB.getByTestId("video-grid")).toBeVisible({ timeout: 30_000 });

  // Each sees the other — only true once media actually flows.
  await expect(page.getByTestId(`video-tile-${MOCK_B.id}`)).toBeVisible({ timeout: 30_000 });
  await expect(pageB.getByTestId("video-tile-e2e-test-user-001")).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: `${OUT}/huddle-a.png` });
  await pageB.screenshot({ path: `${OUT}/huddle-b.png` });

  await hangUp(pageB);
  await hangUp(page);
  await expect(page.getByTestId("video-grid")).toBeHidden({ timeout: 15_000 });

  await ctxB.close();
});

test("huddle docks inside the app window and connects", async ({ page, browser, testWorkspace }) => {
  watch(page, "A");

  const general = await testWorkspace.api.getChannelByName("general");
  const channelId = general!.id;

  // Second account needs workspace + channel membership to join.
  const invite = await testWorkspace.api.createInvite();
  const apiB = createApi(SECOND_USER, testWorkspace.slug);
  await apiB.acceptInvite(invite.code);
  await apiB.joinChannel(channelId);

  // Participant A starts the huddle from the composer.
  await page.setViewportSize({ width: 1280, height: 860 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("start-audio-huddle-button").click();

  // It renders in place — no second window involved.
  const dock = page.getByTestId("huddle-dock");
  await expect(dock).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("video-grid")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/isn't signed in/i)).toHaveCount(0);
  await expectControlsInsideDock(page);
  await page.screenshot({ path: `${OUT}/huddle-dock.png` });

  // Expanding fills the client area edge to edge, controls included.
  await page.getByTestId("huddle-dock-expand").click();
  const expanded = await dock.boundingBox();
  expect(expanded!.width).toBe(1280);
  expect(expanded!.y + expanded!.height).toBe(860);
  await expectControlsInsideDock(page);
  await page.screenshot({ path: `${OUT}/huddle-expanded.png` });
  await page.getByTestId("huddle-dock-expand").click();

  // Participant B joins from their own window.
  const ctxB = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    permissions: ["microphone", "camera"],
  });
  const pageB = await ctxB.newPage();
  await setupMockAuth(pageB, MOCK_B);
  await pageB.goto(`/w/${testWorkspace.slug}`);
  await pageB.getByText("# general").click();
  await expect(pageB.locator(".tiptap")).toBeVisible();
  await pageB.getByTestId("start-audio-huddle-button").click();
  await expect(pageB.getByTestId("huddle-dock")).toBeVisible({ timeout: 15_000 });

  // Each side sees the other, which only happens once media is flowing.
  await expect(page.getByTestId(`video-tile-${MOCK_B.id}`)).toBeVisible({ timeout: 30_000 });
  await expect(pageB.getByTestId("video-tile-e2e-test-user-001")).toBeVisible({ timeout: 30_000 });

  // The full control bar only appears once there is room for it.
  await page.getByTestId("huddle-dock-expand").click();
  await expect(page.getByTestId("huddle-audio-settings")).toBeVisible();

  // Backgrounds are shared state: what A picks, B sees.
  await page.getByTestId("huddle-background").click();
  await page.screenshot({ path: `${OUT}/huddle-backgrounds.png` });
  await page.getByTestId("huddle-background-forest").click();
  await expect(page.getByTestId("huddle-shell")).toHaveAttribute("data-background", "forest");
  await expect(pageB.getByTestId("huddle-shell")).toHaveAttribute("data-background", "forest", {
    timeout: 15_000,
  });

  // So are raised hands and reactions. Picking a swatch closes its menu.
  await expect(page.getByTestId("huddle-background-menu")).toBeHidden();
  await page.getByTestId("huddle-hand-toggle").click();
  await expect(pageB.getByTestId("hand-raised-e2e-test-user-001")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("huddle-reactions").click();
  await page.getByTestId("huddle-reaction-🎉").click();
  await expect(pageB.getByTestId("reaction-e2e-test-user-001")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByTestId("huddle-reaction-menu")).toBeHidden();

  await page.screenshot({ path: `${OUT}/huddle-controls.png` });
  await page.getByTestId("huddle-dock-expand").click();

  // The dock can be minimised and restored without dropping the call.
  await page.getByTestId("huddle-dock-minimize").click();
  await expect(page.getByTestId("huddle-dock-restore")).toBeVisible();
  await page.getByTestId("huddle-dock-restore").click();
  await expect(page.getByTestId("video-grid")).toBeVisible();

  await hangUp(pageB);
  await hangUp(page);
  await expect(page.getByTestId("huddle-dock")).toBeHidden({ timeout: 15_000 });

  await ctxB.close();
});

/**
 * Screen sharing switches the huddle to the presentation layout. That layout
 * once gave the shared tile no definite height, so the picture grew past the
 * grid and painted over the control bar — the controls looked like they had
 * vanished.
 */
test("a shared screen stays inside the grid and leaves the controls usable", async ({
  page,
  testWorkspace,
}) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("start-audio-huddle-button").click();
  await expect(page.getByTestId("video-grid")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("huddle-dock-expand").click();
  await page.getByTestId("huddle-screenshare-toggle").click();
  await expect(page.getByTestId("permission-alert")).toHaveCount(0);

  // The published track has to arrive before the layout changes.
  const video = page.locator("video").first();
  await expect(video).toBeVisible({ timeout: 20_000 });

  const grid = (await page.getByTestId("video-grid").boundingBox())!;
  const picture = (await video.boundingBox())!;
  expect(picture.y + picture.height).toBeLessThanOrEqual(grid.y + grid.height);

  // Every control is still reachable, not buried under the picture.
  for (const id of [
    "huddle-mute-toggle",
    "huddle-camera-toggle",
    "huddle-screenshare-toggle",
    "huddle-hand-toggle",
    "huddle-leave",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  const bar = (await page.getByTestId("huddle-control-bar").boundingBox())!;
  expect(bar.y).toBeGreaterThanOrEqual(grid.y + grid.height);
});

/**
 * Remote control is offered per share, and the offer depends on what the
 * sharer announced. A browser cannot have input injected into it, so the
 * button has to explain itself rather than silently doing nothing.
 */
test("a viewer is told why a browser share cannot be controlled", async ({
  page,
  browser,
  testWorkspace,
}) => {
  const general = await testWorkspace.api.getChannelByName("general");
  const channelId = general!.id;

  const invite = await testWorkspace.api.createInvite();
  const apiB = createApi(SECOND_USER, testWorkspace.slug);
  await apiB.acceptInvite(invite.code);
  await apiB.joinChannel(channelId);

  await page.setViewportSize({ width: 1280, height: 860 });
  await setupMockAuth(page);
  await page.goto(`/w/${testWorkspace.slug}`);
  await page.getByText("# general").click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByTestId("start-audio-huddle-button").click();
  await expect(page.getByTestId("video-grid")).toBeVisible({ timeout: 30_000 });

  const ctxB = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    permissions: ["microphone", "camera"],
  });
  const pageB = await ctxB.newPage();
  await setupMockAuth(pageB, MOCK_B);
  await pageB.goto(`/w/${testWorkspace.slug}`);
  await pageB.getByText("# general").click();
  await expect(pageB.locator(".tiptap")).toBeVisible();
  await pageB.getByTestId("start-audio-huddle-button").click();
  await expect(pageB.getByTestId("huddle-dock")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`video-tile-${MOCK_B.id}`)).toBeVisible({ timeout: 30_000 });

  // A shares, B watches.
  await page.getByTestId("huddle-dock-expand").click();
  await page.getByTestId("huddle-screenshare-toggle").click();
  await pageB.getByTestId("huddle-dock-expand").click();

  const request = pageB.getByTestId("remote-control-request");
  await expect(request).toBeVisible({ timeout: 20_000 });
  await expect(request).toBeDisabled();
  await request.hover();
  await expect(pageB.getByText(/needs the desktop app/i)).toBeVisible();

  // The sharer is never prompted for a request that was never sent.
  await expect(page.getByTestId("remote-control-prompt")).toHaveCount(0);

  await hangUp(pageB);
  await hangUp(page);
  await ctxB.close();
});
