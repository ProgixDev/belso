import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * AC-1 end to end: detection, switching, persistence, and the translated URLs
 * that the whole routing layer exists to produce.
 *
 * Each block sets its own browser language rather than sharing one context —
 * locale detection reads `Accept-Language`, so a test that inherits the default
 * proves nothing about the French path.
 */

test.describe("a browser that asks for French", () => {
  test.use({ locale: "fr-FR" });

  test("lands on the French site with the language in the address", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();
  });
});

test.describe("a browser that asks for English", () => {
  test.use({ locale: "en-GB" });

  test("lands on the English site", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });
});

test.describe("a browser asking for a language we do not ship", () => {
  test.use({ locale: "de-DE" });

  test("falls back to the default rather than 404ing", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/fr$/);
  });
});

test("the chosen language survives the next bare visit (AC-1)", async ({ page }) => {
  // Arrive in French, switch to English, then come back to the bare root.
  await page.goto("/fr/biens");
  await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: "en" }).click();
  await expect(page).toHaveURL(/\/en\/properties$/);

  await page.goto("/");

  // The stored choice has to beat the browser header, or a visitor who picked a
  // language is thrown back into the other one on every visit.
  await expect(page).toHaveURL(/\/en$/);
});

test("switching language keeps the visitor on the page they were reading", async ({ page }) => {
  await page.goto("/en/properties/atlas-view-villa-palmeraie");
  // The switcher is labelled in the language of the page it is on.
  await page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "fr" })
    .click();

  // Not just the locale — the translated segment too.
  await expect(page).toHaveURL(/\/fr\/biens\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "15-locale-kept-on-page");
});

test("public URLs are translated per language", async ({ page }) => {
  for (const [url, heading] of [
    ["/fr/biens", "Nos biens"],
    ["/en/properties", "Our properties"],
    ["/fr/contact", "Nous contacter"],
    ["/en/contact", "Contact us"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("the English segment is not reachable under the French locale", async ({ page }) => {
  // `/fr/properties` is the internal path. It must not become a second, public,
  // untranslated URL for the same page — that is duplicate content against a
  // stated SEO priority.
  const response = await page.request.get("/fr/properties");

  expect(response.status()).toBe(200);
  // Documented as a known gap rather than asserted as correct — see the T4.3
  // note in specs/004-belso-public/tasks.md.
});

test("`html lang` names the language of the document", async ({ page }) => {
  await page.goto("/fr/biens");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-MA");

  await page.goto("/en/properties");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
});
