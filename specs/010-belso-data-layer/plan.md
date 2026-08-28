# Plan 010 — Listings come from a database, not from fixtures

- **Spec:** [spec.md](spec.md) (all open questions resolved: no — one owner action remains, and it does not block implementation; see _Assumptions pending confirmation_)
- **Author:** Claude (agent) · **Date:** 2026-08-28

## Approach

Replace the bodies of the six functions in `src/features/properties/repository.ts` with SQL, and
change nothing above them. That file was built as this seam and says so; the whole plan rests on
the claim being true, so **T2 proves it before any database exists** by capturing what the fixtures
produce through the public repository API and freezing it.

The trade-off taken is **explicit SQL over an ORM**. Six read functions and one insert do not
justify a query builder, a schema DSL and a migration tool; `pg` plus hand-written SQL keeps the
dependency count near where it is (ADR-0001 values that) and keeps the queries legible to whoever
debugs them at 2am. Migrations are numbered `.sql` files applied by a small runner — the same
shape as `supabase/migrations/`, which the team already reads, minus the CLI.

The one genuinely delicate part is **not the SQL — it is proving the swap changed nothing.** So
the plan front-loads a golden-output test (T2): serialize what the fixtures produce today through
the public repository API, commit it, and require the database-backed implementation to match it
byte-for-byte. That is what makes AC-1 a real assertion rather than a hopeful e2e pass.

Requires no new ADR: [ADR-0008](../../docs/architecture/decisions/0008-postgres-on-our-own-vps.md)
already decided Postgres-on-our-VPS and no Supabase. `pg` is a driver for a decided database, not
a new architectural choice.

## Placement (per `docs/architecture/module-boundaries.md`)

| What                     | Where                                             | Notes                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection pool          | `src/core/db.ts`                                  | `server-only`. `core` is the bottom layer, so every slice may reach it and it may reach nothing. One pool per process, module-level on purpose — it is not request state, unlike a Zustand store. |
| Property reads           | `src/features/properties/repository.ts`           | **Bodies only.** The six exported signatures do not change. Already `server-only`.                                                                                                                |
| Property row → domain    | `src/features/properties/row.ts`                  | New. Maps a joined SQL row to `Property`. Kept out of `repository.ts` so the SQL and the mapping are separately testable.                                                                         |
| Enquiry write            | `src/features/enquiries/actions.ts`               | Replaces the painted-door comment. Signature, zod schema and result shape already match what the real action needs.                                                                               |
| Enquiry rate limit       | `src/features/enquiries/rate-limit.ts`            | New. Postgres-backed counter — the app may run in more than one process, so in-memory would not hold.                                                                                             |
| Migrations               | `db/migrations/NNNN_*.sql`                        | New top-level `db/`, mirroring `supabase/migrations/` in shape. Not under `src/` — it is not application code.                                                                                    |
| Migration + seed runners | `scripts/migrate.mjs`, `scripts/seed.mjs`         | Alongside the repo's existing `scripts/*.mjs`.                                                                                                                                                    |
| Backup + retention job   | `scripts/backup.mjs`, deployed as a systemd timer | Runs on the VPS, not in the app.                                                                                                                                                                  |
| Env                      | `src/core/env.ts`                                 | `DATABASE_URL` server-side only. Never `NEXT_PUBLIC_*` — `check-secrets` would reject it, correctly.                                                                                              |

No route, component or store changes. If this plan ends up touching `src/app/`, something has
gone wrong with the seam and it should be raised, not worked around.

## Data & state

**Schema.** Six tables. `districts` (the ten, with their centres — currently a TS record),
`properties`, `property_translations` (per-locale slug/title/description, `Partial` by design so
a missing locale is a missing row), `property_media`, `property_slug_history` (AC-7), `enquiries`.

Two points that are easy to get wrong:

- **Publication state is a new axis, not the existing one.** `properties.status` already exists
  and means the _commercial_ state (`available`, `underOffer`, `sold`, `rented`). This spec adds
  `publication` (`draft`, `published`, `archived`). Conflating them would make "sold" invisible
  and "archived" purchasable. They get separate columns and separate enums.
- **Every public read filters `publication = 'published'`.** Not the callers — the repository,
  once, in every query. AC-2 lists five entry points precisely because a filter applied per-caller
  is a filter that will be missed at the sixth.

**Server data.** Unchanged: RSC calls the repository directly, no client fetching. Caching stays
as it is; a query per request against local Postgres on the same box is well inside budget and
adding a cache layer in the same change as a data-layer swap would confuse the diff.

**Client state.** None. Nothing in this spec reaches the browser.

**Actions.** `submitEnquiryAction` keeps its zod validation and gains an insert plus a rate-limit
check. No authz — it is deliberately public — so the rate limit is the only thing standing
between the form and a full table (AC-4).

## Acceptance criteria → verification mapping

| AC       | Proven by                                                                                                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** | unit: `repository.golden.test.ts` — database output must equal the committed fixture snapshot exactly · e2e: existing `properties.spec.ts`, `districts.spec.ts`, `map.spec.ts`, `home.spec.ts` pass unchanged                 |
| **AC-2** | unit: `repository.test.ts` — a drafted listing is absent from all six read functions · e2e: `properties.spec.ts` new step — direct URL 404s in `fr` and `en`, and the slug is absent from `/sitemap.xml`                      |
| **AC-3** | unit: `repository.test.ts` — archived absent from `listProperties`, still returned by a direct row query                                                                                                                      |
| **AC-4** | unit: `actions.test.ts` — valid submit inserts one row with the reference; the 6th submit in a window returns the throttled error and inserts nothing                                                                         |
| **AC-5** | unit: `repository.test.ts` — pool error surfaces as a typed failure, not an empty array · e2e: `db-down.spec.ts` — catalogue renders the error state with the database stopped; `/contact` still serves                       |
| **AC-6** | script: `scripts/restore-check.mjs` — dump, restore into a scratch database, diff row counts and the golden snapshot against it. **Runs the restore.** Wired into `pnpm verify:db`, not `pnpm verify` (needs a live Postgres) |
| **AC-7** | unit: `repository.test.ts` — `getPropertyBySlug` resolves a historical slug · e2e: `properties.spec.ts` — old URL 301s to the current one                                                                                     |
| **AC-8** | script: `scripts/seed.mjs` run twice in `restore-check` · unit asserts 20 properties, not 40                                                                                                                                  |

AC-5's e2e needs the database stopped, which no existing spec does — it gets its own file so it
can be excluded from the default run without weakening the others.

## Risks & unknowns

- **The seam might leak.** `localizeProperty` enumerates fields by hand and a missing one arrives
  as `undefined` while typechecking clean — the exact failure noted in spec 009's plan. The
  golden snapshot (T2) is the de-risk: a dropped field changes the snapshot and fails loudly.
- **Ordering is not stable across a swap.** `sortProperties` sorts in TypeScript today; SQL
  `ORDER BY` with ties resolves differently. AC-1 says "the same order", so sorting **stays in
  TypeScript** for this spec — SQL returns rows, the existing pure functions order them. Moving
  the sort into SQL is a later optimisation with its own test.
- **Dates.** `listedAt` is an ISO date string and `formatDate` was already bitten by UTC
  (spec 009). Columns are `date`, not `timestamptz`, and the mapper produces the same string
  shape the fixtures do. The golden snapshot catches a drift of one day.
- **Two processes, one rate limit.** In-memory counters do not survive a second instance; hence
  the Postgres-backed counter. It is one extra write per submit, which is affordable.
- **Enquiries are personal data from the first insert.** Retention (24 months, assumed) has to
  ship _with_ the table, not after it, or there is a period with no deletion path.
- **Nothing here is deployed.** The app keeps running where it runs; only the database moves onto
  the VPS. Deploying the app is deliberately a separate change with separate failure modes.

## Overlap check

Active specs: **009 (map)** — status `active`, touches `src/features/properties`. Real overlap:
`resolveLocation` and `districts.ts` become database-backed, and `map.spec.ts` is in AC-1's
regression set.

Resolution: **sequence, not split.** 009 is code-complete and pushed (`1e114dd`); only its Phase 5
close-out remains, which is review and documentation and touches no source. This spec must not
begin editing `districts.ts` until 009's report is filed, or the report will describe a slice that
has moved underneath it. T0 checks that first.
