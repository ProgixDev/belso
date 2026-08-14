import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

const SCENE = 'section[aria-label="Besto cinematic scroll story"]';

/**
 * The scene lerps toward the scroll target over ~2s, so a shot taken too early
 * catches a half-played frame. Wait until a motion variable has been unchanged
 * for 20 consecutive animation frames.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return false;
      const value = el.style.getPropertyValue("--back-scale");
      if (!value) return false;
      const stable = el.dataset.settleValue === value ? Number(el.dataset.settleCount ?? 0) + 1 : 0;
      el.dataset.settleValue = value;
      el.dataset.settleCount = String(stable);
      return stable >= 20;
    },
    SCENE,
    { timeout: 30_000, polling: "raf" },
  );
}

async function scrollTo(page: import("@playwright/test").Page, y: number) {
  await page.evaluate(
    ([selector, top]) => {
      // Reset the stability counter, or the previous target's settled value
      // satisfies `settle` before this scroll has moved anything.
      const el = document.querySelector<HTMLElement>(String(selector));
      delete el?.dataset.settleValue;
      delete el?.dataset.settleCount;
      window.scrollTo({ top: Number(top), behavior: "instant" });
    },
    [SCENE, y] as const,
  );
  await settle(page);
}

// CUJ-01 — Land and travel the Besto scroll story (docs/product/critical-user-journeys.md)
test("@cuj CUJ-01: visitor lands and scrolls through the residence story", async ({ page }) => {
  await page.goto("/");

  // The splash intro staggers the chrome in over ~2.6s; wait for its last beat.
  await page.waitForFunction(
    (selector) =>
      document.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--in-note") ===
      "1.0000",
    SCENE,
    { timeout: 15_000 },
  );
  await expect(page.getByRole("heading", { level: 1, name: "Besto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book a call" })).toBeVisible();
  await shot(page, "01-hero", { fullPage: false });

  await scrollTo(page, 1500);
  await expect(page.getByRole("heading", { name: "A quieter kind of address" })).toBeVisible();
  await shot(page, "02-about", { fullPage: false });

  await scrollTo(page, 2900);
  await expect(page.getByRole("heading", { name: "A slower way to live." })).toBeVisible();
  await shot(page, "03-residences", { fullPage: false });

  await scrollTo(page, 4800);
  await expect(
    page.getByRole("heading", { name: "Everything close, nothing near." }),
  ).toBeVisible();
  await shot(page, "04-amenities", { fullPage: false });

  await scrollTo(page, 6600);
  const slider = page.getByRole("region", { name: "Besto residences slider" });
  await expect(slider).toBeVisible();
  await shot(page, "05-residences-slider", { fullPage: false });

  // The slider loops infinitely, so the next card is always reachable.
  await page.getByRole("button", { name: "Next residence" }).click();
  await shot(page, "06-slider-advanced", { fullPage: false });
});
