import { test, expect, type Page } from "@playwright/test";

// Studio Menu fold (studioMenu.ts), the synced-game cards in the right
// column, and the WAVE errors fixed on 2026-11-05 (empty button, SVGs with
// no text alternative, redundant titles).

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

test.describe("Studio Menu fold", () => {
  test("desktop: folds into an icon rail, widens the stage, and is remembered", async ({ page }) => {
    test.skip(!isWide(page), "the rail is the desktop layout");
    await page.goto("/");
    const toggle = page.locator("#studio-nav-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const stageBefore = (await page.locator(".studio-stage-column").boundingBox())!.width;

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#today-section")).toBeHidden();
    await expect(page.locator("#sync-section")).toBeHidden();
    // The links stay in the rail, as icons.
    await expect(page.locator(".studio-nav-link").first()).toBeVisible();
    const stageAfter = (await page.locator(".studio-stage-column").boundingBox())!.width;
    expect(stageAfter).toBeGreaterThan(stageBefore + 100);

    await page.reload();
    await expect(page.locator("#studio-nav-toggle")).toHaveAttribute("aria-expanded", "false");

    // A rail link to a folded-away card opens the menu first.
    await page.locator('.studio-nav-link[href="#today-section"]').click();
    await expect(page.locator("#studio-nav-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#today-section")).toBeVisible();
  });

  test("narrow screens: the menu starts as a closed drawer", async ({ page }) => {
    test.skip(isWide(page), "the drawer is the narrow layout");
    await page.goto("/");
    const toggle = page.locator("#studio-nav-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#studio-nav-list")).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#studio-nav-list")).toBeVisible();
  });
});

test("a menu click moves the highlight and flashes its target", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("#studio-nav-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const link = page.locator('.studio-nav-link[href="#play-section"]');
  await link.click();
  await expect(link).toHaveClass(/active/);
  await expect(link).toHaveAttribute("aria-current", "location");
  await expect(page.locator('.studio-nav-link[href="#sync-section"]')).not.toHaveClass(/active/);
  await expect(page.locator("#play-section")).toHaveClass(/nav-target-flash/);
});

test("synced game cards keep their details inside the card", async ({ page }) => {
  await page.goto("/");
  await page.locator("#demo-load-btn").click();
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
