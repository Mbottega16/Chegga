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

test.describe("landing page smoke", () => {
  test("loads with no thrown errors or console errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console.error: ${msg.text()}`);
    });

    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForTimeout(1500);

    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("shows the simplified header (Sync, Theme) without redundant Play/Stockfish/Feedback buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header.header")).toBeVisible();
    await expect(page.locator("#hero-analyze-btn")).toBeVisible();
    await expect(page.locator("#orientation-switcher")).toHaveCount(0);
    await expect(page.locator("#hero-play-btn")).toHaveCount(0);
    await expect(page.locator("#feedback-btn")).toHaveCount(0);
    await expect(page.locator(".header-engine-pill")).toHaveCount(0);
  });

  test("the connect form is simplified and reachable by keyboard", async ({ page }) => {
    await page.goto("/");
    // The form lives in the menu; on a phone the menu starts as a closed drawer.
    const toggle = page.locator("#studio-nav-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await expect(page.locator(".shell-nav #sync-section")).toBeVisible();
    await expect(page.locator("#sync-section h2")).toHaveText("Get connected.");
    await expect(page.locator("#sync-section .card-teaser")).toHaveText(
      "Enter your Chess.com or Lichess username to load your recent games and track your progress.",
    );
    await expect(page.locator("#demo-load-btn")).toHaveCount(0);
    await expect(page.locator("#analyze-recent-form")).toHaveCount(0);

    const username = page.locator("#username");
    await page.locator('.studio-nav-link[href="#sync-section"]').click(); // "Getting Connected." focuses the field
    await expect(username).toBeFocused();
    await username.fill("MagnusCarlsen");
    await expect(page.locator("#sync-site")).toBeVisible();
    await expect(page.locator("#hero-analyze-btn")).toBeVisible();
  });

  test("the data export control is present (no silent data-loss trap)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#export-data-btn")).toBeAttached();
  });

  test("the game review is wired up, and stays hidden until there is a game", async ({ page }) => {
    await page.goto("/");
    const panel = page.locator("#review-panel");
    await expect(panel).toBeAttached();
    await expect(panel).toBeHidden();
    for (const id of [
      "#review-strip-host",
      "#review-caption",
      "#review-first",
      "#review-prev",
      "#review-next",
      "#review-last",
      "#review-autoplay",
      "#review-heatmap-btn",
      "#review-why",
      "#review-candidates",
      "#review-try",
      "#review-save",
      "#try-panel",
    ]) {
      await expect(page.locator(id)).toBeAttached();
    }
    // Removed on purpose: the worst-move, fix-your-mistakes and save-key-moments
    // buttons, and the "position before" checkbox (the heatmap button does that).
    for (const id of ["#review-worst", "#review-drill", "#review-save-key", "#review-before"]) {
      await expect(page.locator(id)).toHaveCount(0);
    }
    await expect(page.locator("#try-panel")).toBeHidden();
  });

  test("the game picker shows a waiting state before there are games", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#picker-section");
    await expect(section).toBeVisible();
    await expect(section.locator(".empty-state")).toBeVisible();
    await expect(section.locator("[data-empty-cta]").first()).toBeVisible();
    await expect(page.locator('a[href="#picker-section"]')).toBeAttached();
  });

  test("body does not scroll horizontally on a phone viewport", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(2);
  });
});

const GROWTH_CARDS = [
  { section: "#road-section", output: "#road-output", expect: /Model estimate now/i },
  { section: "#weekly-plan-section", output: "#weekly-plan-output", expect: /Mon|Tue|Wed/i },
  { section: "#blunder-rate-section", output: "#blunder-rate-output", expect: /per 100/i },
  { section: "#consistency-section", output: "#consistency-output", expect: /after a loss/i },
  { section: "#convert-section", output: "#convert-output", expect: /\+\d/ },
];

test.describe("bundled demo dataset", () => {
  test("every growth card renders real content, with no errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console.error: ${msg.text()}`);
    });

    await page.goto("/");
    await page.locator(".picker-demo-cta-btn").first().click();

    await expect(page.locator("#demo-banner")).toBeVisible();
    await expect(page.locator("#sync-log")).toContainText(/sample games/i);

    for (const card of GROWTH_CARDS) {
      const section = page.locator(card.section);
      await expect(section).toBeAttached();
      await expect
        .poll(async () => section.evaluate((el: HTMLElement) => el.style.display), {
          message: `${card.section} stayed hidden — its compute function returned nothing`,
        })
        .not.toBe("none");

      const output = page.locator(card.output);
      await expect(output).toContainText(card.expect);
      const text = ((await output.textContent()) ?? "").trim();
      expect(text.length, `${card.output} rendered almost nothing`).toBeGreaterThan(80);
      expect(text).not.toMatch(/not enough data|no data yet/i);
    }

    await expect(page.locator("#profile-output")).toContainText(/\d/);
    await expect(page.locator("#picker-output")).toContainText(/\d/);

    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("clearing the demo returns the page to its empty state", async ({ page }) => {
    await page.goto("/");
    await page.locator(".picker-demo-cta-btn").first().click();
    await expect(page.locator("#demo-banner")).toBeVisible();

    await page.locator("#demo-clear-btn").click();

    await expect(page.locator("#demo-banner")).toBeHidden();
    await expect(page.locator("#picker-section .empty-state")).toBeVisible();
    await expect(page.locator("#road-section")).toHaveJSProperty("style.display", "none");
  });

  test("the demo survives a reload without trying to sync a fake account", async ({ page }) => {
    const siteRequests: string[] = [];
    await page.goto("/");
    await page.locator(".picker-demo-cta-btn").first().click();
    await expect(page.locator("#demo-banner")).toBeVisible();

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("chess.com") || url.includes("lichess.org")) siteRequests.push(url);
    });

    await page.reload();
    await expect(page.locator("#demo-banner")).toBeVisible();
    await expect(page.locator("#profile-output")).toContainText(/\d/);
    expect(siteRequests, siteRequests.join("\n")).toEqual([]);
  });
});
