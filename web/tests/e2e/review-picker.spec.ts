import { test, expect, type Page } from "@playwright/test";

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


// Picker -> review -> reasons -> best-move heatmap -> practice -> saved
// positions, against a real (seeded) synced game and the real WASM engine.
// Runs against the local build (see playwright.config.ts). The Chess.com
// API is stubbed so nothing depends on the network.
//
// The seeded game is one where White (the reviewer) hangs the queen on move
// 3 (3.Qxe5+?? Nxe5), so there is a certain, explainable blunder to find.

const PGN =
  "1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 4. d4 Nc6 5. d5 Nb8 6. Nc3 Nf6 7. Bg5 Be7 8. Bxf6 Bxf6 0-1";

const GAME = {
  chessComUuid: "e2e-picker-1",
  username: "tester",
  url: "",
  pgn: PGN,
  timeControl: "600",
  timeClass: "rapid",
  rules: "chess",
  rated: true,
  endTime: 1_780_000_000,
  openingName: "Bongcloud-ish Queen Grab",
  whiteUsername: "tester",
  whiteRating: 1200,
  blackUsername: "rival",
  blackRating: 1250,
  whiteResult: "resigned",
  blackResult: "win",
  userColor: "white",
  userResult: "loss",
  analyzed: false,
};

/** `moreRoutes` runs after the catch-all Chess.com stub, so its routes win. */
async function seedAndLoad(page: Page, moreRoutes?: (page: Page) => Promise<void>) {
  await page.route("https://api.chess.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ archives: [] }) }),
  );
  await moreRoutes?.(page);
  await page.goto("/");
  await page.waitForTimeout(800); // let the app create its DB
  await page.evaluate(async (game) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("chegga-web");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("games", "readwrite");
        tx.objectStore("games").put(game);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
    localStorage.setItem("chegga-web:last-username", "tester");
  }, GAME);
  await page.reload();
}

async function playMove(page: Page, from: string, to: string) {
  await page.locator(`#play-board-wrap [data-square="${from}"]`).click();
  await page.locator(`#play-board-wrap [data-square="${to}"]`).click();
}

const AVATAR = "https://images.chesscomfiles.com/uploads/v1/user/e2e-rival.png";
// A 1x1 PNG, so the picture really loads without the network.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("the last-10 list shows a Chess.com opponent's profile picture, and remembers it", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  let lookups = 0;
  page.on("request", (r) => {
    if (r.url() === "https://api.chess.com/pub/player/rival") lookups += 1;
  });
  await seedAndLoad(page, async (p) => {
    await p.route("https://api.chess.com/pub/player/rival", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "rival", avatar: AVATAR }) }),
    );
    await p.route(AVATAR, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }));
  });

  const picture = page.locator("#recent-list .recent-avatar img");
  await expect(picture).toHaveAttribute("src", AVATAR);
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  expect(lookups).toBe(1);

  // A week-long memory: a reload shows the picture with no new lookup.
  await page.reload();
  await expect(picture).toHaveAttribute("src", AVATAR);
  expect(lookups).toBe(1);
  expect(problems, problems.join("\n")).toEqual([]);
});

test.describe("game picker and review", () => {
  test.setTimeout(150_000);

  test("picks a synced game, explains the blunder, shades the best moves, practices, saves", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

    await seedAndLoad(page);

    // --- the picker shows the game as a card ---
    const card = page.locator("#picker-section .picker-card");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Loss");
    await expect(card).toContainText("rival");
    await expect(card).toContainText("Analyze & review");

    // --- opening it analyzes it on demand, then opens the review ---
    await card.click();
    await expect(page.locator("#review-panel")).toBeVisible({ timeout: 100_000 });
    await expect(page.locator("#picker-status")).toHaveText("");

    // --- the review names the turning point in one card ---
    await expect(page.locator("#review-moves-host .turning-point-card")).toHaveCount(1);
    await expect(page.locator("#review-moves-host .turning-point-card .tp-why")).toContainText("winning chances");

    // --- the reason for the worst move names the piece (W jumps to it) ---
    await page.keyboard.press("w");
    await expect(page.locator("#review-caption")).toContainText("Blunder");
    await expect(page.locator("#review-why")).toBeVisible();
    await expect(page.locator("#review-why")).toContainText("queen on e5");

    // --- before view: the ranked candidates are shaded and listed ---
    await page.locator("#review-heatmap-btn").click();
    await expect(page.locator("#review-heatmap-btn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#review-caption")).toContainText("Position before");
    await expect(page.locator("#review-candidates .candidate-chip").first()).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("#review-candidates .candidate-chip").count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator("#play-board-wrap .play-candidate-tint").count()).toBeGreaterThanOrEqual(1);
    const heat = page.locator("#play-board-wrap .play-trail-layer g.hm-move");
    expect(await heat.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator("#play-board-wrap g.hm-played")).toHaveCount(1);
    await page.screenshot({ path: "test-results/review-before-view.png", fullPage: false });

    // tapping a candidate brings that move to the front of the heatmap
    await page.locator("#review-candidates .candidate-chip").nth(2).click();
    await page.mouse.move(1, 1);
    await expect(page.locator("#play-board-wrap g.hm-preview.hm-focus")).toHaveCount(1);

    // --- try the position: a wrong move, then a strong one ---
    const strongUci = await page.locator("#review-candidates .candidate-chip").first().getAttribute("data-candidate");
    await page.locator("#review-try").click();
    await expect(page.locator("#try-panel")).toBeVisible();
    await expect(page.locator("#try-status")).toContainText("Your turn");
    await playMove(page, "a2", "a3");
    await expect(page.locator("#try-status")).toContainText("Not quite");
    await expect(page.locator("#try-show")).toBeVisible();
    await page.locator("#try-again").click();
    await playMove(page, strongUci!.slice(0, 2), strongUci!.slice(2, 4));
    await expect(page.locator("#try-status")).toContainText("✓");

    // --- leaving the try goes back to the review ---
    await page.locator("#try-done").click();
    await expect(page.locator("#try-panel")).toBeHidden();
    await expect(page.locator("#review-caption")).toContainText("Position before");

    // --- save it, and it shows up under Saved positions ---
    await page.locator("#review-save").click();
    await expect(page.locator("#saved-positions .saved-row")).toHaveCount(1);
    await expect(page.locator("#review-save")).toHaveAttribute("aria-label", "Saved ✓");

    // --- and it survives a reload, practiceable with no game open ---
    await page.reload();
    await expect(page.locator("#saved-positions .saved-row")).toHaveCount(1);
    await page.locator("[data-saved-try]").first().click();
    await expect(page.locator("#try-panel")).toBeVisible();
    await expect(page.locator("#review-panel")).toBeHidden();
    await playMove(page, "a2", "a3");
    await expect(page.locator("#try-status")).toContainText(/Not quite|✓/);
    await page.locator("#try-done").click();
    await expect(page.locator("#try-panel")).toBeHidden();

    // --- remove it (saved positions live on the Games tab) ---
    await page.locator("#tab-games").click();
    await page.locator("[data-saved-remove]").first().click();
    await expect(page.locator("#saved-positions .saved-row")).toHaveCount(0);

    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("a review does not lose a bot game in progress", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

    await seedAndLoad(page);

    // Start a bot game and make a move; the bot answers. (The bot's controls
    // live on the Analysis tab.)
    await page.locator("#tab-analysis").click();
    await page.locator("#bot-new-game-btn").click();
    await expect(page.locator("#play-status")).toContainText("Your move", { timeout: 15_000 });
    await playMove(page, "e2", "e4");
    await expect(page.locator("#play-move-list")).toContainText("e4");
    await expect(page.locator("#play-status")).toContainText("Your move", { timeout: 30_000 }); // the bot has replied

    // Opening a synced game takes over the board and offers the game back.
    await page.locator("#tab-games").click();
    await page.locator("#picker-section .picker-card").click();
    await expect(page.locator("#review-panel")).toBeVisible({ timeout: 100_000 });
    await expect(page.locator("#resume-banner")).toBeVisible();

    await page.locator("#resume-btn").click();
    await expect(page.locator("#review-panel")).toBeHidden();
    await expect(page.locator("#play-move-list")).toContainText("e4");
    await expect(page.locator("#resume-banner")).toBeHidden();

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
