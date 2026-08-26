import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * CUJ-05 — find a property on the map (spec 009).
 *
 * The map is WebGL and has no DOM to assert against, so these wait on the one
 * signal it publishes — `data-map-ready` — rather than sleeping, the same way
 * the scene specs wait on `--in-cta`. Everything else is asserted through the
 * markers, which are real buttons precisely so that this is possible.
 */

const MAP = "/fr/biens?view=map";
const READY = '[data-map-ready="1"]';

/** A marker for one property: named by the property, not by a number. */
const pins = (page: import("@playwright/test").Page) =>
  page.locator(".maplibregl-marker button").filter({ hasNotText: /^\d+$/ });

/** A marker standing for several: its whole label is the count. */
const clusters = (page: import("@playwright/test").Page) =>
  page.locator(".maplibregl-marker button").filter({ hasText: /^\d+$/ });

test("@cuj CUJ-05: a visitor opens the map, finds a property on it, and reaches its page", async ({
  page,
}) => {
  await page.goto("/fr/biens");
  await page.getByRole("link", { name: "Voir sur la carte" }).click();

  await expect(page).toHaveURL(/view=map/);
  await page.waitForSelector(READY, { timeout: 30_000 });
  await shot(page, "30-map");

  // AC-1: the catalogue is on the map, not just beside it.
  await expect(page.locator(".maplibregl-marker button").first()).toBeVisible();
  expect(await page.locator(".maplibregl-marker button").count()).toBeGreaterThan(4);

  // AC-2: opening a point gives the property, and a way into it.
  const pin = pins(page).first();
  const name = await pin.getAttribute("aria-label");
  await pin.click();
  const card = page.locator("[data-map-ready] article");
  await expect(card).toBeVisible();
  await expect(card).toContainText(name!.split(",")[0]!.trim());
  await shot(page, "31-map-property");

  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/fr\/biens\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("AC-3: properties standing together are one marker, and it separates when opened", async ({
  page,
}) => {
  await page.goto(MAP);
  await page.waitForSelector(READY, { timeout: 30_000 });

  const cluster = clusters(page).first();
  await expect(cluster).toBeVisible();
  await expect(cluster).toHaveAttribute("aria-label", /\d+ biens/);

  const before = await page.locator(".maplibregl-marker button").count();
  await cluster.click();
  // The camera eases in; the markers regroup when it settles.
  await expect
    .poll(async () => page.locator(".maplibregl-marker button").count(), { timeout: 15_000 })
    .toBeGreaterThan(before);
});

test("AC-4: the visitor can ask for prices on the points", async ({ page }) => {
  await page.goto(MAP);
  await page.waitForSelector(READY, { timeout: 30_000 });

  // A dot names its property for a screen reader but shows no price. Asserting
  // empty text would be wrong: the accessible name is in an `sr-only` span, and
  // it should be.
  await expect(pins(page).first()).not.toContainText(/MAD|€/);

  await page.getByRole("button", { name: "Prix" }).click();
  // A price in MAD, compacted for a pin: "5,8 M MAD", "45 k MAD".
  await expect.poll(async () => (await pins(page).first().textContent()) ?? "").toMatch(/MAD|€/);
  await shot(page, "32-map-prices");
});

test("AC-8: with no satellite imagery configured, the choice is not offered", async ({ page }) => {
  await page.goto(MAP);
  await page.waitForSelector(READY, { timeout: 30_000 });

  // Offering a control that cannot work is worse than not offering it. This
  // flips to a visible button the day a satellite style URL is set.
  await expect(page.getByRole("button", { name: "Défaut" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Satellite" })).toHaveCount(0);
});

test("AC-5: the map says the locations are approximate", async ({ page }) => {
  await page.goto(MAP);
  await page.waitForSelector(READY, { timeout: 30_000 });

  /*
   * Every listing is placed by its district today, so the caveat is on screen.
   * When the back-office supplies real coordinates for all of them it goes away
   * by itself — at which point this assertion is the thing that should be
   * updated, deliberately, rather than the caveat being left lying.
   */
  await expect(page.getByText(/Emplacements approximatifs/)).toBeVisible();
});

test("AC-1: the view is in the address, so it can be shared and reloaded", async ({ page }) => {
  await page.goto("/fr/biens?q=riad&view=map");
  await page.waitForSelector(READY, { timeout: 30_000 });

  // The search survives the view, and the view survives a reload.
  await expect(page.getByText("“riad”")).toBeVisible();
  await page.reload();
  await page.waitForSelector(READY, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Voir la liste" }).first()).toBeVisible();
});

test("a stale or hostile view falls back to the list rather than throwing", async ({ page }) => {
  const response = await page.goto("/fr/biens?view=satellite-3d");
  expect(response?.status()).toBe(200);
  await expect(page.locator("main ul > li article").first()).toBeVisible();
});

/*
 * AC-6, asserted against the server's response rather than the rendered DOM.
 *
 * Playwright's `javaScriptEnabled: false` disables script *execution* without
 * flipping the scripting flag Chrome styles with, so `<noscript>` keeps its
 * `display: none` and its contents have no box — measured: the element is
 * attached, its bounding box is null, and the cards inside it count zero. A
 * browser with JavaScript genuinely off renders them.
 *
 * So the DOM cannot answer this, and asserting on it would be asserting on a
 * quirk of the harness. What can be answered, and is the thing that actually
 * matters, is whether the bytes we send contain a usable list.
 */
test("AC-6: the response carries every property for a visitor without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get(MAP)).text();

  const fallback = html.slice(
    html.indexOf("<noscript>", html.indexOf("besoin de JavaScript") - 400),
  );
  expect(fallback).toContain("La carte a besoin de JavaScript");

  // Every listing, inside the fallback rather than merely somewhere on the page.
  const cards = fallback.slice(0, fallback.indexOf("</noscript>")).match(/<article/g) ?? [];
  expect(cards.length).toBeGreaterThanOrEqual(20);
});
