// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { locales } from "@/core/i18n";
import { districtIds } from "./districts";
import {
  countByDistrict,
  countProperties,
  getLocaleSlugs,
  getPropertyBySlug,
  getSimilar,
  listProperties,
} from "./repository";
import { propertySorts } from "./types";

// `server-only` resolves by the `react-server` export condition, not by the
// test environment, so importing the repository trips its guard even under
// node. Stubbing it here keeps that guard real everywhere else.
vi.mock("server-only", () => ({}));

/**
 * The oracle for spec 010's AC-1.
 *
 * This exists **before** the database does, and that ordering is the whole
 * point. `repository.ts` is about to have all six of its bodies rewritten in
 * SQL, and the promise attached to that change is that a visitor sees no
 * difference whatsoever. A promise like that is worth nothing unless something
 * can fail when it is broken.
 *
 * So: drive every read path a page actually uses, serialize the results, and
 * freeze them. Against fixtures this is trivially green — it is *supposed* to
 * be, today. Its value is entirely in what it does tomorrow, when the bodies
 * are SQL and one join drops a translation or one `ORDER BY` resolves a tie the
 * other way. Then this fails, loudly, naming the exact query and field.
 *
 * Why a hand-rolled snapshot rather than `toMatchSnapshot()`: an inline
 * snapshot is easy to regenerate by reflex when it goes red, which is exactly
 * the wrong instinct here. A committed file that must be deleted deliberately
 * makes "I changed the output" a decision rather than a keystroke.
 *
 * **If this test fails during the swap, the swap is wrong.** Do not update the
 * snapshot to match the database. The one legitimate reason to regenerate it is
 * a deliberate, spec'd change to what the catalogue shows — and spec 010
 * promises the opposite of that.
 */

/**
 * A list query is recorded as its ordered references, not its full rows.
 *
 * Every listing appears in eight or so list queries, so storing whole records
 * each time produced a 1 MB snapshot that was 90% the same paragraphs repeated
 * — noisy to diff and slow to format. Ordering and membership are what a list
 * query can get wrong; the field-level content is covered once per listing per
 * locale by the detail captures below. Between them the coverage is the same
 * and the file is a twentieth of the size.
 */
const order = (properties: { reference: string }[]) => properties.map((p) => p.reference);

/** Every query a page issues today, named so a failure says which one broke. */
async function captureCatalogue() {
  const capture: Record<string, unknown> = {};

  for (const locale of locales) {
    // The unfiltered catalogue in each sort — the listing index and the map.
    for (const sort of propertySorts) {
      capture[`list:${locale}:${sort}`] = order(await listProperties({ locale, sort }));
    }

    // Each district page's listings.
    for (const district of districtIds) {
      capture[`district:${locale}:${district}`] = order(await listProperties({ locale, district }));
    }

    // A search with words in it, and one that matches nothing. The empty result
    // is included on purpose: "no results" is a state the SQL can get wrong in
    // a way that returning everything would hide.
    capture[`search:${locale}:riad`] = order(await listProperties({ locale, query: "riad" }));
    capture[`search:${locale}:none`] = order(
      await listProperties({ locale, query: "zzzz-no-such-listing" }),
    );
  }

  capture.countProperties = await countProperties();
  capture.countByDistrict = await countByDistrict();

  // Every listing's detail page, in every language: the record itself, its
  // hreflang alternates, and the similar row beneath it. Driven off the French
  // catalogue so the set is stable regardless of which locales translate.
  const all = await listProperties({ locale: "fr" });
  for (const property of all) {
    capture[`similar:${property.id}`] = order(await getSimilar(property.id, "fr"));

    const slugs = await getLocaleSlugs(property.slug);
    capture[`slugs:${property.reference}`] = slugs;

    for (const locale of locales) {
      const slug = slugs[locale];
      // The full record — this is where every field is actually pinned.
      if (slug) capture[`detail:${locale}:${slug}`] = await getPropertyBySlug(slug, locale);
    }
  }

  return capture;
}

/**
 * Written once, from the fixtures, then left alone.
 *
 * Regenerating requires `UPDATE_GOLDEN=1` on purpose. Doing it to clear a red
 * test during the SQL swap defeats the entire point — a difference there means
 * the database is showing visitors something other than what they see today,
 * which is precisely what spec 010 promises will not happen. Fix the query.
 */
const snapshotPath = () =>
  join(dirname(fileURLToPath(import.meta.url)), "__golden__", "catalogue.json");

function writeSnapshotIfAsked(captured: Record<string, unknown>): boolean {
  if (process.env.UPDATE_GOLDEN !== "1") return false;

  const path = snapshotPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(captured, null, 2)}\n`);
  return true;
}

/**
 * Skipped without a database, and that is the whole point.
 *
 * This used to run inside `pnpm test` with no `DATABASE_URL` — which meant the
 * repository returned the fixtures, and the snapshot had been generated from
 * those same fixtures. The oracle was comparing fixtures with a frozen copy of
 * fixtures. It could not fail for any SQL reason, and it reported green under
 * the heading "AC-1".
 *
 * A test that cannot fail is worse than a missing one, because it occupies the
 * space where the real check would go and makes the gate look honest. It now
 * runs under `vitest.db.config.mts` (`pnpm test:db`), against Postgres, where
 * it was already proven capable of failing: changing one listing's price by a
 * single dirham in the database alone turns it red and names the query.
 */
const describeGolden = process.env.DATABASE_URL ? describe : describe.skip;

describeGolden("repository golden output (spec 010 AC-1)", () => {
  // 113 repository calls over an SSH tunnel to Paris at ~44ms a round trip.
  // In production the app sits on the same host as the database and this is
  // roughly a millisecond; the tunnel is a development cost, not a real one.
  it("matches the committed snapshot exactly", { timeout: 180_000 }, async () => {
    const captured: Record<string, unknown> = JSON.parse(JSON.stringify(await captureCatalogue()));

    if (writeSnapshotIfAsked(captured)) {
      console.warn("golden snapshot rewritten from the current repository output");
      return;
    }

    // Read, not `import`: a static import of the snapshot is resolved when the
    // module is transformed, so the very first run — before the file exists —
    // would fail to build rather than telling you to generate it.
    const frozen = JSON.parse(readFileSync(snapshotPath(), "utf8")) as Record<string, unknown>;

    // Compared key by key rather than as one blob: a whole-object diff over
    // twenty listings is unreadable, and the first thing anyone debugging this
    // needs to know is *which query* changed.
    expect(Object.keys(captured).sort()).toEqual(Object.keys(frozen).sort());
    for (const key of Object.keys(frozen)) {
      expect(captured[key], `query: ${key}`).toEqual(frozen[key]);
    }
  });

  it(
    "covers every district, locale and sort, so the snapshot cannot go quietly stale",
    { timeout: 180_000 },
    async () => {
      const captured = await captureCatalogue();
      const keys = Object.keys(captured);

      // Guards the oracle itself. If a locale or district is added later and this
      // capture is not extended, the snapshot would still pass while covering
      // less than it claims — a green test that has stopped watching.
      for (const locale of locales) {
        expect(keys.filter((key) => key.includes(`:${locale}:`)).length).toBeGreaterThanOrEqual(
          propertySorts.length + districtIds.length,
        );
      }
      expect(await countProperties()).toBeGreaterThan(0);
    },
  );
});
