import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { openWorkspaceChannel, sendMessage } from "./helpers/ui";

test.describe("Messaging journey", () => {
  test.describe.configure({ mode: "serial" });

  let slug: string;

  test("navigate to channel and see the editor", async ({ page, testWorkspace }) => {
    slug = testWorkspace.slug;
    await openWorkspaceChannel(page, slug);

    // Editor is visible and focusable
    const editor = page.locator(".tiptap");
    await editor.click();
    await expect(editor).toBeFocused();
  });

  test("send a message and see it appear", async ({ page, testWorkspace }) => {
    await openWorkspaceChannel(page, testWorkspace.slug);

    const msg = `hello-e2e-${Date.now()}`;
    await sendMessage(page, msg);

    // Message is visible with author name
    await expect(page.getByText(msg)).toBeVisible();
    await expect(page.getByText("Test User").first()).toBeVisible();
  });

  test("send multiple messages and verify ordering", async ({ page, testWorkspace }) => {
    await openWorkspaceChannel(page, testWorkspace.slug);

    const ts = Date.now();
    const msgs = [`msg-a-${ts}`, `msg-b-${ts}`, `msg-c-${ts}`];

    for (const msg of msgs) {
      await sendMessage(page, msg);
    }

    // All visible and in chronological order
    const body = await page.textContent("body");
    const positions = msgs.map((m) => body!.indexOf(m));
    expect(positions[0]).toBeGreaterThan(-1);
    expect(positions[0]).toBeLessThan(positions[1]!);
    expect(positions[1]).toBeLessThan(positions[2]!);
  });

  test("messages persist after page refresh", async ({ page, testWorkspace }) => {
    await openWorkspaceChannel(page, testWorkspace.slug);

    const msg = `persist-${Date.now()}`;
    await sendMessage(page, msg);

    // Full page reload
    await page.reload();
    await page.getByText("# general").click();
    await expect(page.locator(".tiptap")).toBeVisible();

    await expect(page.getByText(msg)).toBeVisible();
  });

  test("a folder file can be @-mentioned and appears as a chip in the message", async ({
    page,
    testWorkspace,
  }) => {
    await openWorkspaceChannel(page, testWorkspace.slug);

    // Put a link into a new folder tab for this channel.
    await page.getByTestId("channel-tab-add").click();
    await page.getByTestId("channel-tab-add-folder").click();
    await expect(page.getByTestId("folder-view")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("folder-add-button").click();
    await page.getByTestId("folder-add-link").click();
    await page.getByTestId("folder-link-url").fill("https://spec.example.com");
    await page.getByTestId("folder-link-name").fill("E2E Spec");
    await page.getByTestId("folder-link-submit").click();
    await expect(page.getByText("E2E Spec")).toBeVisible();

    // Back to messages, mention the file via the @ menu.
    await page.getByTestId("channel-tab-messages").click();
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("here it is @E2E Sp");

    const option = page.getByRole("button", { name: "E2E Spec" });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await page.keyboard.press("Enter");

    // The sent message carries a file-mention chip, not raw token text.
    const chip = page.getByTestId("file-mention").last();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toContainText("E2E Spec");
    await expect(page.getByText("<@file:")).toHaveCount(0);
  });
});
