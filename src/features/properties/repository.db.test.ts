// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

vi.mock("server-only", () => ({}));

/**
 * The behaviours that only exist once there is a database (spec 010).
 *
 * Separate from `repository.golden.test.ts` because these **write**. The golden
 * test asks "does the database show what the fixtures showed"; this one asks
 * "what happens to a listing the client has not published yet", which cannot be
 * answered without putting one into that state.
 *
 * Skipped when `DATABASE_URL` is unset, which is the normal state for
 * `pnpm verify` and for a contributor who has just cloned the repository. That
 * is a deliberate trade: the alternative is making a database a prerequisite
 * for touching the front end. `pnpm verify:db` is where these are expected to
 * run, and the feature report records the result.
 *
 * Every test restores what it changed in a `finally`. These run against the
 * real catalogue, so a test that leaves a listing unpublished takes the
 * catalogue down for whoever looks next.
 */
const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("repository against Postgres (spec 010)", () => {
  let sql: pg.Client;

  // The reference is fixed rather than "the first one": a test that picks its
  // own subject reports a different failure depending on sort order.
  const SUBJECT = "BL-1101";

  beforeAll(async () => {
    sql = new pg.Client({ connectionString: url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
  });

  /**
   * Import the repository fresh.
   *
   * `catalogue()` is wrapped in React's `cache`, which is exactly what we want
   * per request in production and exactly what would hide a change here: the
   * second read would answer from the first. Re-importing gives each assertion
   * an un-memoised view of the row as it now stands.
   */
  async function freshRepository() {
    vi.resetModules();
    return import("./repository");
  }

  async function setPublication(reference: string, state: string) {
    await sql.query("update properties set publication = $1 where reference = $2", [
      state,
      reference,
    ]);
  }

  it("AC-2: a draft is invisible to every read a page makes", async () => {
    const before = await freshRepository();
    const subject = (await before.listProperties({ locale: "fr" })).find(
      (property) => property.reference === SUBJECT,
    );
    expect(subject, "the fixture catalogue should contain the subject").toBeDefined();
    const slug = subject!.slug;

    // Captured *before* the mutation. Reading the baseline afterwards — even
    // through the module imported earlier — measures the changed world and
    // compares it with itself, which passes or fails for the wrong reason.
    const totalBefore = await before.countProperties();
    const inDistrictBefore = (await before.countByDistrict())[subject!.districtId];

    try {
      await setPublication(SUBJECT, "draft");
      const repo = await freshRepository();

      // The catalogue, in both languages.
      for (const locale of ["fr", "en"] as const) {
        const listed = await repo.listProperties({ locale });
        expect(listed.map((p) => p.reference)).not.toContain(SUBJECT);
      }

      // Its own address, directly — the URL a crawler or a shared link holds.
      expect(await repo.getPropertyBySlug(slug, "fr")).toBeNull();

      // The district page it would appear on.
      const district = await repo.listProperties({ locale: "fr", district: subject!.districtId });
      expect(district.map((p) => p.reference)).not.toContain(SUBJECT);

      // The counts the index and the empty-search route print.
      expect(await repo.countProperties()).toBe(totalBefore - 1);
      expect((await repo.countByDistrict())[subject!.districtId]).toBe(inDistrictBefore - 1);

      // The sitemap builds from the same slug lookup, so this is the assertion
      // that keeps an unpublished listing out of it.
      expect(await repo.getLocaleSlugs(slug)).toEqual({});
    } finally {
      await setPublication(SUBJECT, "published");
    }
  });

  it("AC-3: an archived listing leaves the catalogue but not the database", async () => {
    try {
      await setPublication(SUBJECT, "archived");
      const repo = await freshRepository();

      expect((await repo.listProperties({ locale: "fr" })).map((p) => p.reference)).not.toContain(
        SUBJECT,
      );

      // Still there, with its history — the difference between archiving and
      // deleting, and the reason "show sold properties" stays a read filter
      // rather than a migration.
      const { rows } = await sql.query(
        `select p.reference, count(t.*)::int as translations
         from properties p
         left join property_translations t on t.property_id = p.id
         where p.reference = $1 group by p.reference`,
        [SUBJECT],
      );
      expect(rows[0]).toMatchObject({ reference: SUBJECT });
      expect(rows[0].translations).toBeGreaterThan(0);
    } finally {
      await setPublication(SUBJECT, "published");
    }
  });

  it("AC-7: renaming a listing records its old address, and the old address still resolves", async () => {
    const { rows: original } = await sql.query(
      "select property_id, slug from property_translations where locale = 'fr' and property_id = (select id from properties where reference = $1)",
      [SUBJECT],
    );
    const { property_id: propertyId, slug: originalSlug } = original[0];
    const renamed = `${originalSlug}-renamed`;

    try {
      await sql.query(
        "update property_translations set slug = $1 where property_id = $2 and locale = 'fr'",
        [renamed, propertyId],
      );

      // The trigger, not the application, recorded it — which is the point:
      // a back-office that forgets to write history cannot forget this.
      const { rows: history } = await sql.query(
        "select slug from property_slug_history where property_id = $1 and locale = 'fr'",
        [propertyId],
      );
      expect(history.map((row) => row.slug)).toContain(originalSlug);

      const fresh = await freshRepository();

      // The old address points at the new one, in the language being read.
      expect(await fresh.getCurrentSlugFor(originalSlug, "fr")).toBe(renamed);

      // And the new address is the one that actually serves a page.
      expect(await fresh.getPropertyBySlug(renamed, "fr")).not.toBeNull();
      expect(await fresh.getPropertyBySlug(originalSlug, "fr")).toBeNull();
    } finally {
      await sql.query(
        "update property_translations set slug = $1 where property_id = $2 and locale = 'fr'",
        [originalSlug, propertyId],
      );
      await sql.query("delete from property_slug_history where property_id = $1", [propertyId]);
    }
  });

  it("a slug that was never ours is not a redirect", async () => {
    const repo = await freshRepository();
    expect(await repo.getCurrentSlugFor("never-existed-anywhere", "fr")).toBeNull();
  });
});
