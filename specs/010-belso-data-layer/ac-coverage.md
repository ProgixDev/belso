# AC coverage — corrected after the review board

The first version of this ticked all eight criteria. Four reviewers disagreed, and on the
substance they were right: two ACs were ticked on tests that could not fail for the reason the
criterion describes, and one was ticked for behaviour that did not exist at any route.

What each is actually backed by, stated plainly. `[~]` means the behaviour is believed correct
and the evidence does not yet prove it at the level the criterion describes.

| AC       | State | Evidence, and what it does not cover                                                                                                                                                                                                                                                                        |
| -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** | `[x]` | Golden snapshot against Postgres, byte-for-byte across 113 queries, and proven able to fail — one dirham changed in the database alone turns it red and names the query. **Runs in `pnpm test:db`, not `pnpm verify`.** Inside `verify` it compared fixtures with a frozen copy of fixtures: a tautology.   |
| **AC-2** | `[~]` | Proven at the repository (`repository.db.test.ts`). **Not** proven at the pages the criterion names: nothing asserts the drafted listing's URL returns 404, nor that its slug is absent from the rendered sitemap. Those routes were prerendered until this review found it; now dynamic, still unasserted. |
| **AC-3** | `[x]` | Archived absent from the catalogue, record and translations retained.                                                                                                                                                                                                                                       |
| **AC-4** | `[x]` | Storage, the per-sender limit, and the attempt limit. The reference-salted bypass found by review — a script could mint a fresh counter per submission — is fixed and covered.                                                                                                                              |
| **AC-5** | `[~]` | Three e2e tests and inspected screenshots, but they skip unless `DB_DOWN=1` and no gate sets it. Shot 41 is mislabelled: it shows `/fr/quartiers`, not the home page. The "rest of the site" assertion was passing on prerendered pages that never touched the database.                                    |
| **AC-6** | `[x]` | A real restore, verified by running the site's own oracle against the restored copy. The table list is hardcoded and omits `property_slug_history`, `enquiry_throttle` and `schema_migrations`.                                                                                                             |
| **AC-7** | `[~]` | The redirect **now exists**. It did not when this was first ticked — `getCurrentSlugFor` was written, unit-tested, and never exported or called, so an old URL 404'd exactly as before. Covered by a unit test; the e2e step T12 claimed is still missing.                                                  |
| **AC-8** | `[~]` | No automated test. "Three seed runs, still 20 properties" was a manual observation typed into a markdown file, which is not evidence.                                                                                                                                                                       |

## What this cost, and the lesson

Every one of these over-claims came from the same move: asserting on the layer I had just
written rather than the layer the criterion describes. `getPropertyBySlug` returning `null` is
not "the URL returns not-found". A repository filter is not "absent from the sitemap". A
function passing its unit test is not "the visitor is redirected".

The harness fix is in `docs/process/definition-of-done.md`: an acceptance criterion is proven by
a test that exercises it **at the altitude it is written at** — if it says "a visitor", the test
drives a browser or asserts a response.
