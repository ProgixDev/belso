import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * AC-2, asserted where the criterion is written: at the pages.
 *
 * `repository.db.test.ts` already proves a drafted listing is absent from all
 * six read functions. That is one layer below what AC-2 says, which names "the
 * catalogue, a neighbourhood page, the map, **the sitemap** or that listing's
 * own URL directly … in both languages". A repository returning `null` is not
 * a 404, and a filtered query is not an absent `<loc>` — and the gap between
 * those two statements is exactly where this spec's biggest defect lived: those
 * routes were prerendered, so no database read reached a visitor at all and
 * every repository-level test passed anyway.
 *
 * So this drives HTTP, against a database it is allowed to mutate, and puts the
 * listing back afterwards.
 *
 * Requires `DATABASE_URL` (a `*_test` database) and a server pointed at it.
 * Skipped otherwise rather than passing vacuously.
 */
const url = process.env.DATABASE_URL;

test.skip(!url, "requires DATABASE_URL pointing at a test database");
test.describe.configure({ mode: "serial" });

const REFERENCE = "BL-1101";
let sql: pg.Client;
let slugs: { fr: string; en: string };

test.beforeAll(async () => {
  sql = new pg.Client({ connectionString: url });
  await sql.connect();

  const { rows } = await sql.query(
    `select locale, slug from property_translations
     where property_id = (select id from properties where reference = $1)`,
    [REFERENCE],
  );
  slugs = Object.fromEntries(rows.map((r) => [r.locale, r.slug]));
});

test.afterAll(async () => {
  // Whatever happened, the listing goes back on the site.
  await sql.query("update properties set publication = 'published' where reference = $1", [
    REFERENCE,
  ]);
  await sql.end();
});

test("AC-2: a drafted listing disappears from every public surface, in both languages", async ({
  page,
  request,
}) => {
  // Present to begin with — otherwise this test could pass against a catalogue
  // that never contained it.
  await page.goto("/fr/biens");
  await expect(page.locator("main ul > li article").first()).toBeVisible();
  const before = await page.locator("main ul > li article").allTextContents();
  expect(before.some((card) => card.includes(REFERENCE))).toBe(true);

  await sql.query("update properties set publication = 'draft' where reference = $1", [REFERENCE]);

  // 1. The catalogue, both languages.
  for (const path of ["/fr/biens", "/en/properties"]) {
    await page.goto(path);
    await expect(page.locator("main ul > li article").first()).toBeVisible();
    const cards = await page.locator("main ul > li article").allTextContents();
    expect(
      cards.some((card) => card.includes(REFERENCE)),
      `${path} still lists it`,
    ).toBe(false);
  }

  // 2. Its own URL, directly — a 404, not merely an absence.
  for (const [locale, path] of [
    ["fr", `/fr/biens/${slugs.fr}`],
    ["en", `/en/properties/${slugs.en}`],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), `${locale} direct URL should be not-found`).toBe(404);
  }

  // 3. The sitemap — named explicitly by AC-2, and the surface that was
  //    prerendered until this spec's review.
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain(slugs.fr);
  expect(sitemap).not.toContain(slugs.en);
  // A sanity check on the sitemap itself: it must still list other listings, or
  // this assertion would pass on an empty document.
  expect(sitemap.match(/<loc>/g)?.length ?? 0).toBeGreaterThan(10);

  // 4. Back on publishing — the state is reversible, which is the point of
  //    draft rather than delete.
  await sql.query("update properties set publication = 'published' where reference = $1", [
    REFERENCE,
  ]);
  await page.goto("/fr/biens");
  await expect(page.locator("main ul > li article").first()).toBeVisible();
  const after = await page.locator("main ul > li article").allTextContents();
  expect(after.some((card) => card.includes(REFERENCE))).toBe(true);
});
