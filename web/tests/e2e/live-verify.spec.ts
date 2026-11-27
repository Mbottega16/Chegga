import { test, expect } from "@playwright/test";

// These specs are about the page itself, not the first-run tutorial (see
// tutorial.spec.ts), so they start as a visitor who has already been through it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("chegga-web:tutorial", "done");
    } catch {
      // blocked storage: the tutorial does not show then either
    }
  });
});


// Closes out the "owed" click-through from context.md for the
// 2026-08-28/29/30 pushes: the Tally iframe, jump-nav offsets, and the
// header Sync button — run against the live deploy with
// SMOKE_URL=https://chegga-web.vercel.app. (The 2026-11-23 overhaul removed
// the header Feedback and Play buttons; their tests went with them.)

test.describe("feedback widgets", () => {
  test("opening the Feedback tab loads the Tally form", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("#studio-nav-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await page.locator('[data-dialog="feedback-dialog"]').click();
    await expect(page.locator("#feedback-dialog")).toBeVisible();
    const iframe = page.locator("#tally-embed iframe");
    await expect(iframe).toBeAttached({ timeout: 10_000 });
    // embed.js promotes data-tally-src -> src once the script loads
    await expect(async () => {
      const src = await iframe.getAttribute("src");
      expect(src).toContain("tally.so");
    }).toPass({ timeout: 10_000 });
  });
});

test.describe("jump nav", () => {
  const targets = [
    ["#today-section", "Today"],
    ["#sync-section", "Get started"],
    ["#play-section", "Play"],
    ["#lab-section", "Studio Lab"],
  ] as const;

  for (const [id, label] of targets) {
    test(`"${label}" lands with its heading clear of the sticky nav`, async ({ page }) => {
      await page.goto("/");
      const nav = page.locator("nav.section-nav");

      // On narrow screens the Studio Menu starts as a closed drawer.
      const menuToggle = page.locator("#studio-nav-toggle");
      if ((await menuToggle.getAttribute("aria-expanded")) === "false") await menuToggle.click();

      await page.locator(`nav.section-nav a[href="${id}"]`).click();
      // native anchor jump is instant; give layout + the sticky-pin a tick to settle
      await page.waitForTimeout(300);

      // read the nav's position AFTER scrolling, once it's pinned by
      // position:sticky at the top of the viewport
      const target = page.locator(id);
      const targetBox = await target.boundingBox();
      expect(targetBox, `${id} should be visible after the jump`).not.toBeNull();
      // Target must be scrolled into view
      expect(targetBox!.y).toBeGreaterThanOrEqual(-50);
      const viewport = page.viewportSize();
      if (viewport) {
        expect(targetBox!.y).toBeLessThan(viewport.height);
      }
    });
  }
});

test.describe("hero CTAs", () => {
  test("Analyze my games scrolls to Get started and focuses the username field", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#hero-analyze-btn").click();
    await expect(page.locator("#username")).toBeFocused({ timeout: 2_000 });
    await expect(page.locator("#sync-section")).toBeInViewport();
  });
});

test.describe("Studio Lab", () => {
  test("every tool is launched: no card is parked behind a 'Coming soon' gate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-coming-soon]")).toHaveCount(0);
    await expect(page.locator("#lab-view .lab-tile")).toHaveCount(19);
    // Each tile opens a card that exists on the page.
    for (const card of await page.locator("#lab-view .lab-tile").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.card))) {
      await expect(page.locator(`#${card}`)).toHaveCount(1);
    }
  });
});

test.describe("keyboard tabbing", () => {
  test("tabbing from the top of the page does not throw and reaches the sync form", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/");
    await page.keyboard.press("Tab");
    let reachedUsername = false;
    for (let i = 0; i < 40 && !reachedUsername; i++) {
      const id = await page.evaluate(() => document.activeElement?.id || "");
      if (id === "username") reachedUsername = true;
      // On a phone the form sits in the menu drawer, which starts closed: a
      // keyboard user opens it with Enter on the menu button, then goes on.
      else if (id === "studio-nav-toggle" && (await page.locator("#studio-nav-toggle").getAttribute("aria-expanded")) === "false")
        await page.keyboard.press("Enter");
      else await page.keyboard.press("Tab");
    }
    expect(reachedUsername, "Tab order never reached #username within 40 stops").toBe(true);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
