import { test, expect, type Page } from "@playwright/test";

// The Studio Lab (labView.ts, labTools.ts): a list of tools that opens one
// tool at a time, each at its own address. Data comes from the bundled
// sample games (demoData.ts), so nothing here needs the network.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("chegga-web:tutorial", "done");
    } catch {
      // blocked storage: the tutorial does not show then either
    }
  });
});

const openMenu = async (page: Page) => {
  const toggle = page.locator("#studio-nav-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
};

const openLab = async (page: Page) => {
  await openMenu(page);
  await page.locator('#studio-nav-list a[href="#lab-section"]').click();
  await expect(page.locator("#lab-section")).toBeVisible();
};

const loadSampleGames = async (page: Page) => {
  await page.evaluate(() => window.dispatchEvent(new Event("chegga:load-demo")));
  // "Loading the sample games…" comes first; WebKit's slow IndexedDB makes the wait real.
  await expect(page.locator("#sync-log")).toContainText(/Loaded \d+ sample games/, { timeout: 30_000 });
};

const tile = (page: Page, tool: string) => page.locator(`.lab-tile[data-tool="${tool}"]`);

test.describe("Studio Lab", () => {
  test("lists 19 tools in four groups, each with a visible description", async ({ page }) => {
    await page.goto("/");
    await openLab(page);
    await expect(page.locator(".lab-group")).toHaveCount(4);
    await expect(page.locator(".lab-tile")).toHaveCount(19);
    await expect(page.locator(".lab-tile-blurb").first()).toBeVisible(); // not only on hover
    await expect(page.locator("#lab-view")).not.toContainText(/coming soon/i);
    // Tools that need no account say so before any game is synced.
    await expect(tile(page, "themed").locator(".lab-tile-status")).toHaveText("Ready");
    await expect(tile(page, "motifs").locator(".lab-tile-status")).toHaveText("Needs your games");
  });

  test("a tool with nothing to show says what it needs, and the sample games fill it", async ({ page }) => {
    await page.goto("/");
    await openLab(page);
    await tile(page, "motifs").click();
    await expect(page).toHaveURL(/#open=motifs-section$/);
    const note = page.locator("#lab-needs-data");
    await expect(note).toBeVisible();
    await expect(note.locator("h2")).toHaveText("Tactical motifs");
    await note.getByRole("button", { name: "Try the sample games" }).click();
    await expect(page.locator("#motifs-section")).toBeVisible({ timeout: 30_000 });
    await expect(note).toBeHidden();
    await expect(page.locator("#motifs-section h2")).toBeFocused(); // focus follows the note's place
  });

  test("shows one tool at a time; All tools and Back both return to the list", async ({ page }) => {
    await page.goto("/");
    await loadSampleGames(page);
    await openLab(page);
    await tile(page, "dna").click();
    await expect(page.locator("#dna-section")).toBeVisible();
    await expect(page.locator("#lab-section")).toBeHidden();
    await expect(page.locator("#motifs-section")).toBeHidden();
    await expect(page).toHaveTitle("Blunder DNA · Chegga");
    await expect(page.locator("#dna-section h2")).toBeFocused();

    await page.locator("#lab-back").click();
    await expect(page.locator("#lab-section")).toBeVisible();
    await expect(page.locator("#dna-section")).toBeHidden();
    await expect(tile(page, "dna")).toBeFocused();

    await tile(page, "time").click();
    await expect(page.locator("#time-section")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#lab-section")).toBeVisible();
    await expect(page.locator("#time-section")).toBeHidden();
    await page.goForward();
    await expect(page.locator("#time-section")).toBeVisible();
  });

  test("a link with #open= opens that tool straight away", async ({ page }) => {
    await page.goto("/#open=lichess-puzzle-section");
    await expect(page.locator("#lichess-puzzle-section")).toBeVisible();
    await expect(page.locator("#lab-back")).toBeVisible();
    await expect(page.locator("#lab-section")).toBeHidden();
  });

  test("Enter on a focused tile opens its tool", async ({ page }) => {
    await page.goto("/");
    await openLab(page);
    await tile(page, "achievements").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#achievements-section")).toBeVisible();
    await expect(page.locator("#achievements-section h2")).toBeFocused();
  });

  test("Tactical motifs: a picked motif shows its worst examples, which open in the game review", async ({ page }) => {
    await page.goto("/");
    await loadSampleGames(page);
    await openLab(page);
    await expect(tile(page, "motifs").locator(".lab-tile-status")).toContainText("mistakes sorted");
    await tile(page, "motifs").click();
    const rows = page.locator("[data-motif-select]");
    expect(await rows.count()).toBeGreaterThan(1);
    const pick = rows.nth(2);
    const label = (await pick.locator(".motif-row-label").textContent())!;
    await pick.click();
    await expect(page.locator('[data-motif-select][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-motif-select][aria-pressed="true"] .motif-row-label')).toHaveText(label);
    await expect(page.locator("#motif-detail h3")).toHaveText(label);
    await page.locator("#motif-detail [data-review-game]").first().click();
    await expect(page.locator("#review-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#review-caption")).not.toBeEmpty();
  });

  test("Blunder DNA and Time trouble read the sample games", async ({ page }) => {
    await page.goto("/");
    await loadSampleGames(page);
    await openLab(page);
    await tile(page, "dna").click();
    await expect(page.locator("#dna-output .dna-strand")).not.toHaveCount(0);
    await expect(page.locator("#dna-output")).toContainText("mistakes and blunders");
    await page.locator("#lab-back").click();
    await tile(page, "time").click();
    await expect(page.locator("#time-output")).toContainText("by clock left");
    await expect(page.locator("#time-output")).toContainText("Lost on time");
  });

  test("Blunder DNA's drill opens the blunder puzzles with a position on the board", async ({ page }) => {
    await page.goto("/");
    await loadSampleGames(page);
    await openLab(page);
    await tile(page, "dna").click();
    await page.locator("[data-dna-drill]").click();
    await expect(page.locator("#puzzle-section")).toBeVisible();
    await expect(page).toHaveURL(/open=puzzle-section/); // a tool opened from another card gets its address too
    await expect(page.locator("#puzzle-status")).toContainText("find the best move");
  });

  test("an endgame drill is played on the main board", async ({ page }) => {
    await page.goto("/");
    await openLab(page);
    await tile(page, "endgames").click();
    await page.locator("#drill-load-btn").click();
    await expect(page.locator("#play-section")).toBeVisible();
    await expect(page.locator("#lab-view")).toBeHidden();
    await expect(page.locator("#play-status")).toContainText("Your move");
  });
});
