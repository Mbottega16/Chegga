import { test, expect, type Page } from "@playwright/test";

// The one-screen shell (studioMenu.ts): menu, board and tabbed side panel,
// synced-game cards, and WAVE checks.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("chegga-web:tutorial", "done");
    } catch {
      // blocked storage: the tutorial does not show then either
    }
  });
});

const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) > 1040;

const openMenu = async (page: Page) => {
  const toggle = page.locator("#studio-nav-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
};
const menuLink = (page: Page, name: string) => page.locator("#studio-nav-list").getByText(name, { exact: true });

test.describe("menu and side panel", () => {
  test("every menu entry shows its name, with Customize and Feedback after Getting Connected", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    const names = await page.locator("#studio-nav-list .nav-text").allTextContents();
    expect(names).toHaveLength(7);
    expect(names.slice(3, 6)).toEqual(["Getting Connected.", "Customize", "Feedback"]);
    for (const name of names) await expect(menuLink(page, name)).toBeVisible(); // not only on hover
    await expect(page.locator("#orientation-switcher")).toHaveCount(0);
  });

  test("the Customize entry opens the appearance controls and closes again", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.locator('[data-dialog="customize-dialog"]').click();
    await expect(page.locator("#customize-dialog #board-theme")).toBeVisible();
    await expect(page.locator("#customize-dialog #piece-set")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#customize-dialog")).toBeHidden();
  });

  test("the menu opens Training and the Lab as their own screens", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#today-section")).toBeHidden();
    await openMenu(page);
    await menuLink(page, "Daily Training Sets").click();
    await expect(page.locator("#today-section")).toBeVisible();
    await expect(page.locator("#play-section")).toBeHidden();
    await openMenu(page);
    await menuLink(page, "What's Coming Soon").click();
    await expect(page.locator("#coming-soon-section")).toBeVisible();
    await expect(page.locator("#today-section")).toBeHidden();
    await openMenu(page);
    await menuLink(page, "Play vs. Bot").click();
    await expect(page.locator("#play-section")).toBeVisible();
    await expect(page.locator("#panel-analysis")).toBeVisible();
    await expect(page.locator("#coming-soon-section")).toBeHidden();
  });

  test("Back returns to the screen before", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await menuLink(page, "Daily Training Sets").click();
    await expect(page.locator("#today-section")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#play-section")).toBeVisible();
  });

  test("the panel has two tabs, Games and Analysis, that switch with a click and the arrow keys", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.panel-tabs [role="tab"]')).toHaveText(["Games", "Analysis"]);
    await expect(page.locator("#import-section")).toBeVisible();
    await page.locator("#tab-analysis").click();
    await expect(page.locator("#panel-analysis")).toBeVisible();
    await expect(page.locator("#import-section")).toBeHidden();
    await page.locator("#tab-analysis").press("ArrowRight");
    await expect(page.locator("#tab-games")).toHaveAttribute("aria-selected", "true");
  });

  test("Get connected sits in the menu, and its menu entry focuses the username", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".shell-nav #sync-section")).toHaveCount(1);
    await expect(page.locator("#side-panel #sync-section")).toHaveCount(0);
    await openMenu(page);
    await menuLink(page, "Getting Connected.").click();
    await expect(page.locator("#sync-section")).toBeVisible();
    await expect(page.locator("#username")).toBeFocused();
  });

  test("folded rails show only their arrows, with no sideways words", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".rail-label")).toHaveCount(0);
  });

  test("desktop: the menu docks flush to the window's left edge, full height", async ({ page }) => {
    test.skip(!isWide(page), "the docked menu is the desktop layout");
    await page.goto("/");
    const nav = (await page.locator("#studio-grid > .shell-nav").boundingBox())!;
    expect(Math.round(nav.x)).toBe(0);
    expect(Math.round(nav.y)).toBe(0);
    expect(Math.round(nav.height)).toBe(page.viewportSize()!.height);
    await expect(page.locator("#sync-section")).toBeVisible();
  });

  test("desktop: both sides fold, the board keeps its size, and the choice is remembered", async ({ page }) => {
    test.skip(!isWide(page), "folding is the desktop layout");
    await page.goto("/");
    const board = page.locator("#play-board-wrap");
    const before = (await board.boundingBox())!;
    await page.locator("#studio-nav-toggle").click();
    await page.locator("#side-panel-toggle").click();
    await expect(page.locator("#studio-nav-list")).toBeHidden();
    await expect(page.locator("#sync-section")).toBeHidden();
    await expect(page.locator("#import-section")).toBeHidden();
    await expect.poll(async () => Math.round((await board.boundingBox())!.x)).not.toBe(Math.round(before.x));
    expect(Math.round((await board.boundingBox())!.width)).toBe(Math.round(before.width));
    await page.reload();
    await expect(page.locator("#studio-nav-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#side-panel-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.locator("#side-panel-toggle").click();
    await expect(page.locator("#import-section")).toBeVisible();
  });

  test("desktop: the board screen fits the window with no page scroll", async ({ page }) => {
    test.skip(!isWide(page), "one screen is the desktop layout");
    await page.goto("/");
    await expect(page.locator("#splash")).toHaveCount(0);
    const over = await page.evaluate(() => ({
      down: document.documentElement.scrollHeight - innerHeight,
      across: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(over).toEqual({ down: 0, across: 0 });
  });

  test("narrow screens: the menu starts as a closed drawer", async ({ page }) => {
    test.skip(isWide(page), "the drawer is the narrow layout");
    await page.goto("/");
    const toggle = page.locator("#studio-nav-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#studio-nav-list")).toBeHidden();
    await toggle.click();
    await expect(page.locator("#studio-nav-list")).toBeVisible();
  });
});

test("a menu click moves the highlight and flashes its target", async ({ page }) => {
  await page.goto("/");
  await openMenu(page);
  const link = page.locator('.studio-nav-link[href="#play-section"]');
  await link.click();
  await expect(link).toHaveClass(/active/);
  await expect(link).toHaveAttribute("aria-current", "location");
  await expect(page.locator('.studio-nav-link[href="#picker-section"]')).not.toHaveClass(/active/);
  await expect(page.locator("#play-section")).toHaveClass(/nav-target-flash/);
});

test("synced game cards keep their details inside the card", async ({ page }) => {
  await page.goto("/");
  await page.locator(".picker-demo-cta-btn").first().click();
  await expect(page.locator("#demo-banner")).toBeVisible();
  const card = page.locator("#picker-track .picker-card").first();
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const infoBox = (await card.locator(".picker-card-info").boundingBox())!;
  expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
});

test("the stage board fits inside its card", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 600, "phones size the board in mobile.css");
  await page.goto("/");
  const card = (await page.locator("#play-section").boundingBox())!;
  const board = (await page.locator("#play-board-wrap .play-board").boundingBox())!;
  expect(board.x + board.width).toBeLessThanOrEqual(card.x + card.width);
});

test("WAVE errors stay fixed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#evict-yes-btn")).not.toHaveText("");
  for (const svg of [".today-ring-svg", ".empty-state-graphic svg"]) {
    for (const el of await page.locator(svg).all()) {
      await expect(el).toHaveAttribute("aria-hidden", "true");
    }
  }
  await expect(page.locator(".theme-accent-swatch[title]")).toHaveCount(0);
});
