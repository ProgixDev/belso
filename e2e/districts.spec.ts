import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * The neighbourhood pages and the seller's page — the two content areas that
 * are not reachable from the header, and so the two most likely to be broken
 * without anyone noticing.
 */

const INDEX = { fr: "/fr/quartiers", en: "/en/neighbourhoods" };

test("@cuj a visitor chooses a neighbourhood, reads it, and opens a listing in it", async ({
  page,
}) => {
  await page.goto(INDEX.fr);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Ten districts, each one a link with a count beside it.
  const cards = page.locator("main ul > li a[href*='/quartiers/']");
  await expect(cards).toHaveCount(10);
  await shot(page, "20-districts-index");

  await page.getByRole("heading", { name: "Palmeraie", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/quartiers\/palmeraie$/);

  // The editorial, not just a filtered grid: the page has to say something.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const prose = await page.locator("main p").allTextContents();
  expect(prose.join(" ").length).toBeGreaterThan(400);
  await shot(page, "21-district-palmeraie");

  const listings = page.locator("main section ul > li article");
  await expect(listings.first()).toBeVisible();
  const count = await listings.count();
  expect(count).toBeGreaterThanOrEqual(2);

  await listings.first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/fr\/biens\//);
  await shot(page, "22-district-to-listing");
});

test("a district page shows only the listings that stand in it", async ({ page }) => {
  await page.goto("/fr/quartiers/medina");
  const cards = await page.locator("main section ul > li article").allTextContents();
  expect(cards.length).toBeGreaterThanOrEqual(2);
  // Every card names this district. The Kasbah prints its own name because it
  // is the address on the listing, and it is a quarter of the medina — which
  // is exactly why the grouping is done on `districtId` and not on that string.
  for (const card of cards) expect(card).toMatch(/Médina|Kasbah/);
});

test("a listing links back to the neighbourhood it stands in", async ({ page }) => {
  await page.goto("/fr/biens/villa-vue-atlas-palmeraie");
  const link = page.getByRole("link", { name: "Palmeraie", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/fr\/quartiers\/palmeraie$/);
});

test("AC-8: an unknown neighbourhood is a real 404, not a soft one", async ({ page }) => {
  const response = await page.goto("/fr/quartiers/casablanca");
  // Soft 404s get indexed. The route ships no `loading.tsx` precisely so that
  // the status can still be corrected when `notFound()` throws.
  expect(response?.status()).toBe(404);
});

test("the neighbourhoods are reachable in English under their own segment", async ({ page }) => {
  await page.goto(INDEX.en);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/en/neighbourhoods/route-ourika");
  // `exact` matters: two listing titles here end in "Ourika road" as well.
  await expect(page.getByRole("heading", { name: "Ourika road", exact: true })).toBeVisible();
});

test("an owner can find the page about selling and send an enquiry", async ({ page }) => {
  await page.goto("/fr/vendre");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Four steps, numbered — the page exists to say how it works.
  await expect(page.locator("main ol > li")).toHaveCount(4);
  await shot(page, "23-sell");

  await page.getByLabel("Nom").fill("Sophie Ferrand");
  await page.getByLabel("E-mail").fill("sophie@example.com");
  await page.getByLabel("Message").fill("Villa à Targa, 440 m², à vendre au printemps.");
  await page.getByRole("button", { name: "Envoyer" }).click();

  await expect(page.getByRole("status")).toContainText("Vendre avec Belso");
  await shot(page, "24-sell-confirmed");
});
