import { expect, test } from "@playwright/test";

/**
 * What machines read: the sitemap and the structured data.
 *
 * Neither is visible on the page, so neither shows up in a screenshot review —
 * they are exactly the kind of thing that rots quietly. The sitemap shipped
 * listing a single URL for a bilingual site with twelve properties, which told
 * a crawler that one page existed.
 */

const SITEMAP = "/sitemap.xml";

/** The listing every other spec uses. Sale, French and English, twelve photos. */
const VILLA = {
  fr: "/fr/biens/villa-vue-atlas-palmeraie",
  en: "/en/properties/atlas-view-villa-palmeraie",
};
/** A long let — the only listing shape whose price carries a period. */
const RENTAL = "/fr/biens/villa-meublee-location-targa";
/** Written in French only, so the English page falls back (AC-9). */
const UNTRANSLATED = "/en/properties/riad-double-patio-kasbah";

async function jsonLd(page: import("@playwright/test").Page, type: string) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = blocks.map((block) => JSON.parse(block));
  return parsed.find((block) => block["@type"] === type);
}

test.describe("the sitemap", () => {
  test("lists every public page in every language", async ({ page }) => {
    const response = await page.request.get(SITEMAP);
    expect(response.status()).toBe(200);
    const xml = await response.text();

    for (const path of [
      "/fr",
      "/en",
      "/fr/biens",
      "/en/properties",
      "/fr/a-propos",
      "/en/about",
      "/fr/contact",
      "/en/contact",
      "/fr/quartiers",
      "/en/neighbourhoods",
      "/fr/quartiers/palmeraie",
      "/en/neighbourhoods/palmeraie",
      "/fr/vendre",
      "/en/sell",
      VILLA.fr,
      VILLA.en,
    ]) {
      expect(xml, `${path} is missing from the sitemap`).toContain(
        `<loc>http://localhost:3000${path}</loc>`,
      );
    }

    // Two locales × (six fixed pages + ten neighbourhoods + twenty listings).
    const entries = xml.match(/<url>/g)?.length ?? 0;
    expect(entries).toBe(72);
  });

  test("declares each page's translations, matching what the pages claim", async ({ page }) => {
    const xml = await (await page.request.get(SITEMAP)).text();
    expect(xml).toContain('hreflang="fr-MA"');
    expect(xml).toContain('hreflang="en-GB"');

    // The page's own metadata is the other half of this pair; if the two ever
    // disagree, the sitemap is the one a crawler trusts less.
    await page.goto(VILLA.fr);
    const alternate = page.locator('link[rel="alternate"][hreflang="en-GB"]');
    await expect(alternate).toHaveAttribute("href", new RegExp(`${VILLA.en}$`));
  });

  test("leaves out the legal pages while they are noindex", async ({ page }) => {
    const xml = await (await page.request.get(SITEMAP)).text();
    // Asking to be indexed here while refusing it on the page is a contradiction
    // a crawler resolves against the whole site, not just those three URLs.
    expect(xml).not.toContain("/legal/");
  });
});

test.describe("listing structured data", () => {
  test("describes the property a visitor is looking at", async ({ page }) => {
    await page.goto(VILLA.fr);
    const listing = await jsonLd(page, "RealEstateListing");
    expect(listing, "no RealEstateListing block on the page").toBeDefined();

    expect(listing.url).toBe(`http://localhost:3000${VILLA.fr}`);
    expect(listing.name).toBe(await page.getByRole("heading", { level: 1 }).textContent());
    expect(listing.inLanguage).toBe("fr-MA");

    expect(listing.offers.price).toBe(12_800_000);
    expect(listing.offers.priceCurrency).toBe("MAD");
    expect(listing.offers.businessFunction).toContain("#Sell");
    expect(listing.offers.availability).toBe("https://schema.org/InStock");

    expect(listing.about["@type"]).toBe("House");
    expect(listing.about.numberOfBedrooms).toBe(5);
    expect(listing.about.address.addressLocality).toBe("Marrakech");
    expect(listing.about.floorSize.unitCode).toBe("MTK");

    // Relative image paths are useless to anything reading this off-site.
    expect(listing.image.length).toBeGreaterThan(0);
    for (const src of listing.image) expect(src).toMatch(/^https?:\/\//);
  });

  test("says a rent is per month, and a sale is not", async ({ page }) => {
    await page.goto(RENTAL);
    const rental = await jsonLd(page, "RealEstateListing");
    expect(rental.offers.businessFunction).toContain("#LeaseOut");
    expect(rental.offers.priceSpecification.referenceQuantity.unitCode).toBe("MON");

    await page.goto(VILLA.fr);
    const sale = await jsonLd(page, "RealEstateListing");
    expect(sale.offers.priceSpecification).toBeUndefined();
  });

  test("names the language the text is actually in, not the page's", async ({ page }) => {
    // AC-9: this listing has no English, so the page shows French prose with a
    // note. Claiming `en-GB` here would be a lie nothing on the page contradicts.
    await page.goto(UNTRANSLATED);
    const listing = await jsonLd(page, "RealEstateListing");
    expect(listing.inLanguage).toBe("fr-MA");
  });

  test("is not emitted on pages that are not a listing", async ({ page }) => {
    await page.goto("/fr/biens");
    expect(await jsonLd(page, "RealEstateListing")).toBeUndefined();
    // The site-wide block is still there.
    expect(await jsonLd(page, "WebSite")).toBeDefined();
  });
});
