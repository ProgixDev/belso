// @vitest-environment node
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

vi.mock("server-only", () => ({}));

/**
 * AC-8 — running the seed twice leaves twenty listings, not forty.
 *
 * This existed only as a sentence in `tasks.md`: "proven: three seed runs,
 * still 20 properties". That was a true observation and it was not evidence —
 * nothing re-ran it, so the day someone changes an `on conflict` clause the
 * claim silently stops holding and the file still says it does.
 *
 * The seed is a script rather than a module, so this drives it the way a human
 * would: run it, count, run it again, count again.
 */
const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("seed idempotence (spec 010 AC-8)", () => {
  let sql: pg.Client;

  beforeAll(async () => {
    sql = new pg.Client({ connectionString: url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
  });

  const counts = async () => {
    const { rows } = await sql.query(`
      select
        (select count(*)::int from properties)            as properties,
        (select count(*)::int from property_translations) as translations,
        (select count(*)::int from property_media)        as media,
        (select count(*)::int from property_media_alt)    as alts,
        (select count(*)::int from districts)             as districts
    `);
    return rows[0];
  };

  const runSeed = () =>
    execFileSync(
      process.execPath,
      ["--import", "./scripts/lib/ts-alias-hook.mjs", "scripts/seed.mjs"],
      { encoding: "utf8", env: { ...process.env, DATABASE_URL: url } },
    );

  it("adds nothing on a second and third run", { timeout: 120_000 }, async () => {
    runSeed();
    const first = await counts();

    expect(first.properties, "the fixtures should have landed").toBe(20);

    runSeed();
    const second = await counts();
    runSeed();
    const third = await counts();

    // Every table, not just `properties`: the upsert keys differ per table
    // (reference, property+locale, media id), so one of them regressing to an
    // insert would double that table alone and leave the headline count right.
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it(
    "restores a value the client would have changed, which is why it must not run against her database",
    { timeout: 120_000 },
    async () => {
      /*
       * Documenting the seed's real hazard as a test rather than a warning.
       *
       * The seed is convergent towards the fixtures: it overwrites titles, prices
       * and translations. That is correct here and destructive once the
       * back-office exists, which is why `vitest.db.setup.ts` refuses any database
       * not named `*_test`. If this assertion ever fails, the seed has become
       * additive and the guard's reasoning needs revisiting.
       */
      await sql.query("update properties set price = 1 where reference = 'BL-1101'");
      runSeed();

      const { rows } = await sql.query(
        "select price::text from properties where reference = 'BL-1101'",
      );
      expect(rows[0].price).not.toBe("1.00");
    },
  );
});
