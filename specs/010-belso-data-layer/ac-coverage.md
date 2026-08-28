# AC coverage — corrected after the review board

The first version of this ticked all eight criteria. Four reviewers disagreed, and on the
substance they were right: two ACs were ticked on tests that could not fail for the reason the
criterion describes, and one was ticked for behaviour that did not exist at any route.

What each is actually backed by, stated plainly. `[~]` means the behaviour is believed correct
and the evidence does not yet prove it at the level the criterion describes.

| AC       | State | Evidence, and what it does not cover                                                                                                                                                                                                                                                                                 |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** | `[x]` | Golden snapshot against Postgres, byte-for-byte across 113 queries, and proven able to fail — one dirham changed in the database alone turns it red and names the query. **Runs in `pnpm test:db`, not `pnpm verify`.** Inside `verify` it compared fixtures with a frozen copy of fixtures: a tautology.            |
| **AC-2** | `[x]` | Now proven at the pages, by `e2e/draft-listing.spec.ts`: catalogue in both languages, a 404 on the direct URL, absence from the rendered sitemap, and the listing returning when republished. Proven able to fail — reverting the sitemap to prerendered turns it red naming the leaked slug.                        |
| **AC-3** | `[x]` | Archived absent from the catalogue, record and translations retained.                                                                                                                                                                                                                                                |
| **AC-4** | `[x]` | Storage, the per-sender limit, and the attempt limit. The reference-salted bypass found by review — a script could mint a fresh counter per submission — is fixed and covered.                                                                                                                                       |
| **AC-5** | `[~]` | Three e2e tests and inspected screenshots, but they skip unless `DB_DOWN=1` and no gate sets it. Shot 41 is mislabelled: it shows `/fr/quartiers`, not the home page. The "rest of the site" assertion was passing on prerendered pages that never touched the database.                                             |
| **AC-6** | `[x]` | A real restore, verified by running the site's own oracle against the restored copy. The table list is now derived from information_schema, so a dump that lost a table fails rather than comparing the six someone remembered. It previously omitted property_slug_history, enquiry_throttle and schema_migrations. |
| **AC-7** | `[~]` | The redirect **now exists**. It did not when this was first ticked — `getCurrentSlugFor` was written, unit-tested, and never exported or called, so an old URL 404'd exactly as before. Covered by a unit test; the e2e step T12 claimed is still missing.                                                           |
| **AC-8** | `[x]` | Now `seed.db.test.ts`: the seed is run three times and every table is compared, not just the headline count — the upsert keys differ per table, so one regressing to an insert would double that table alone.                                                                                                        |

## What this cost, and the lesson

Every one of these over-claims came from the same move: asserting on the layer I had just
written rather than the layer the criterion describes. `getPropertyBySlug` returning `null` is
not "the URL returns not-found". A repository filter is not "absent from the sitemap". A
function passing its unit test is not "the visitor is redirected".

The harness fix is in `docs/process/definition-of-done.md`: an acceptance criterion is proven by
a test that exercises it **at the altitude it is written at** — if it says "a visitor", the test
drives a browser or asserts a response.

## What the review board cost, and what it bought

Six of eight criteria changed state after four reviewers read the same diff. Two were proven
where they had only been asserted, one was implemented after being ticked, and three needed
tests that could fail.

The pattern in all of them was the same, and it is worth naming once: **I asserted on the layer
I had just written rather than the layer the criterion describes.** `getPropertyBySlug`
returning `null` is not "the URL returns not-found". A repository filter is not "absent from the
sitemap". A function passing its unit test is not "the visitor is redirected".

Two things that only surfaced because the tooling looked:

- The e2e suite had written a real enquiry — "Sophie Ferrand" — into the client's live table,
  from a run with `DATABASE_URL` exported. It sat there until `pnpm db:restore-check` counted
  the rows. Both doors are now guarded (`vitest.db.setup.ts`, `playwright.config.ts`) and refuse
  any database not named `*_test`.
- The live database was one migration behind the scratch one, which the same count revealed.
