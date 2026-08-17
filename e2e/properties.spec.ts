import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * CUJ-03, the part of it that exists after Phase 2: search from the home scene,
 * read the results, open a listing. The enquiry half arrives with Phase 3.
 *
 * Also covers the states that are easy to ship broken and hard to notice: an
 * empty result set, a translated URL, an untranslated listing, and an address
 * that does not exist.
 */

const SCENE = 'section[aria-label="Belso cinematic scroll story"]';

test("@cuj CUJ-03: visitor searches from the home scene and opens a listing", async ({ page }) => {
  await page.goto("/fr");

  // The splash staggers the hero in over ~2.6s. The field is in the DOM from
  // the first frame, so filling it works immediately — but a screenshot taken
  // now is a half-played frame, which is worthless as evidence.
  await page.waitForFunction(
    (selector) =>
      document.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--in-note") ===
      "1.0000",
    SCENE,
    { timeout: 15_000 },
  );

  const search = page.getByRole("searchbox");
  await search.fill("riad medina");
  await shot(page, "01-home-search", { fullPage: false });

  await search.press("Enter");

  // AC-2: the visitor's own words come back to them, with a count.
  await expect(page).toHaveURL(/\/fr\/biens\?q=riad\+medina/);
  await expect(page.getByRole("heading", { level: 1, name: "Nos biens" })).toBeVisible();
  await expect(page.getByText("“riad medina”")).toBeVisible();
  await shot(page, "02-results");

  // AC-3: a result carries its photo, place and price.
  const firstCard = page.locator("article").first();
  await expect(firstCard.getByRole("img")).toBeVisible();
  await expect(firstCard).toContainText("Marrakech");

  await firstCard.getByRole("link").click();

  // AC-5: the listing itself.
  await expect(page).toHaveURL(/\/fr\/biens\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Référence")).toBeVisible();
  await shot(page, "03-detail");

  // The gallery advances.
  const position = page.getByText(/Photo \d+ sur \d+/);
  await expect(position).toHaveText(/Photo 1 sur/);
  await page.getByRole("button", { name: "Photo suivante" }).click();
  await expect(position).toHaveText(/Photo 2 sur/);
  await shot(page, "04-gallery-advanced");
});

test("AC-4: a search that matches nothing says so and offers a way onward", async ({ page }) => {
  await page.goto("/fr/biens?q=zzzz+qqqq");

  await expect(page.getByText("Aucun bien ne correspond à votre recherche")).toBeVisible();
  // Never a bare empty grid — there has to be a route out.
  await expect(page.getByRole("link", { name: "Voir tous les biens" })).toBeVisible();
  await shot(page, "05-empty-results");
});

test("AC-3: sorting reorders the set", async ({ page }) => {
  await page.goto("/fr/biens?sort=priceDesc");
  const firstDesc = await page.locator("article h3").first().textContent();

  await page.goto("/fr/biens?sort=priceAsc");
  const firstAsc = await page.locator("article h3").first().textContent();

  expect(firstDesc).not.toBe(firstAsc);
  await shot(page, "06-sorted-price-asc");
});

test("AC-9: an untranslated listing shows French text with a visible note", async ({ page }) => {
  await page.goto("/en/properties/riad-double-patio-kasbah");

  await expect(page.getByText(/isn’t translated yet/)).toBeVisible();
  // The prose is marked as French so a screen reader does not read it aloud
  // in an English voice.
  await expect(page.locator('[lang="fr-MA"]')).toBeVisible();
  await shot(page, "07-fallback-translation");
});

test("AC-8: an unknown address returns a real 404, not a soft one", async ({ page }) => {
  const response = await page.goto("/fr/biens/nexiste-pas");

  // The status matters as much as the page: a soft 404 gets indexed.
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Ce bien n’existe plus")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir tous les biens" })).toBeVisible();
  await shot(page, "08-not-found");
});

test("AC-1: the locale switcher keeps the visitor on the page they were reading", async ({
  page,
}) => {
  await page.goto("/fr/biens");
  await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: "en" }).click();

  await expect(page).toHaveURL(/\/en\/properties$/);
  await expect(page.getByRole("heading", { level: 1, name: "Our properties" })).toBeVisible();
  await shot(page, "09-locale-switched");
});
