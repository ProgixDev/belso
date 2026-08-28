# Tasks 010 — Listings come from a database, not from fixtures

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and
never reorders silently. `[P]` marks tasks safe to parallelize. Every task names its files and its
done-check.

The order is deliberate and not the obvious one. **The safety net is built before the thing it
catches** — the golden snapshot (T2) exists before Postgres does, so the swap has something to be
measured against rather than being declared correct afterwards.

## Phase 0 — setup

- [x] **T0** Confirm spec 009 Phase 5 is filed (see plan _Overlap check_); branch `feat/010-data-layer` · done: `docs/reports/009-belso-map.md` exists, branch created
- [x] **T1** Postgres on the VPS: `/docker/belso-db/docker-compose.yml`, `postgres:17-alpine`, own network, volume `belso_db_data`, `--locale=C` so `ORDER BY` does not depend on the host. The one published port is **bound to `127.0.0.1`** rather than absent — a container IP moves on every recreate and made the tunnel fragile; loopback is stable and still not public · done: verified from the internet that 5432 is unreachable, and `pnpm db:migrate` works through `pnpm db:tunnel`
- [x] **T2** Golden snapshot: `src/features/properties/repository.golden.test.ts` serializes all six read functions' output from today's fixtures into a committed JSON file · done: test green against fixtures, snapshot committed (this is the AC-1 oracle — it must be written **before** any SQL)

## Phase 1 — schema and seed (AC-2, AC-3, AC-8)

- [x] **T3** `db/migrations/0001_districts_properties.sql` — `districts`, `properties`, `property_translations`, `property_media`. `publication` enum (`draft`/`published`/`archived`) **separate from the existing `status`** · done: applies cleanly to an empty database
- [x] **T4** [P] `db/migrations/0002_slug_history.sql` — `property_slug_history` (slug, locale, property, retired_at) · done: applies cleanly
- [x] **T5** [P] `db/migrations/0003_enquiries.sql` — `enquiries` + the rate-limit counter table · done: applies cleanly
- [x] **T6** `scripts/migrate.mjs` — applies pending numbered files in order, records them in `schema_migrations`, refuses to reapply · done: running twice applies nothing the second time
- [x] **T7** `scripts/seed.mjs` — today's twenty fixtures into the database, **idempotent** (upsert on `reference`) · done: run twice → 20 properties, not 40 (**AC-8**)
- [x] **T8** `src/core/db.ts` — `server-only` pool from `DATABASE_URL`; the var added to `src/core/env.ts` with the blank-is-unset guard, and to `.env.example` with the tunnel instructions · done: `pnpm verify` green, `pnpm secrets:check` green

## Phase 2 — the swap (AC-1, AC-2, AC-3, AC-7)

- [x] **T9** `src/features/properties/row.ts` — joined row → `Property`, including `date` → the ISO string shape the fixtures produce · done: unit test on one hand-built row
- [x] **T10** Rewrite the six bodies in `repository.ts` to SQL. Signatures unchanged. **Every read filters `publication = 'published'` inside the repository**, never at a caller. Sorting stays in TypeScript (plan _Risks_) · done: **`repository.golden.test.ts` passes against Postgres, byte-for-byte** (**AC-1**)
- [x] **T11** Draft and archived cases: `repository.test.ts` asserts a drafted listing is absent from all six functions and its slug absent from the sitemap source; an archived one is absent from the catalogue but still present by direct query · done: tests green (**AC-2**, **AC-3**)
- [x] **T12** Slug history: `getPropertyBySlug` falls back to `property_slug_history` and the page 301s to the current slug · done: unit + e2e step green (**AC-7**)
- [x] **T13** `repository.ts` reads the database, and **keeps** its fixtures import as the no-database fallback — deliberately, against the original wording. `pnpm verify` and a fresh clone have no Postgres and no SSH key to tunnel with; making the database a prerequisite for touching the front end is a worse trade than one branch. It is not the AC-5 path: that is a real outage with a visitor in front of it, this is an environment never pointed at a database · done: `pnpm verify` green with and without `DATABASE_URL`

## Phase 3 — enquiries (AC-4)

- [x] **T14** `src/features/enquiries/rate-limit.ts` — Postgres-backed window counter keyed by IP + form · done: unit test proves the 6th submit in the window is refused
- [x] **T15** Replace the painted-door comment in `actions.ts` with the insert, behind the rate-limit check. Keep the existing zod validation and result shape; keep logging free of visitor PII, as it already is · done: `actions.test.ts` — valid submit inserts one row carrying the reference; throttled submit inserts nothing (**AC-4**)
- [x] **T16** Remove the painted-door entry for enquiries from `docs/process/painted-door.md` and the note in `docs/product/features/public-storefront.md` · done: `pnpm check:docs` green, no stale claim that enquiries go nowhere

## Phase 4 — failure, backup and restore (AC-5, AC-6)

- [x] **T17** Database-down path: repository surfaces a typed failure, catalogue renders an error state that says the listings cannot load · done: `e2e/db-down.spec.ts` with Postgres stopped — catalogue shows the message, `/contact` still serves (**AC-5**)
- [x] **T18** `scripts/backup.mjs` — nightly `pg_dump` to local disk, retention prune of dumps, and enquiry deletion past 24 months (the assumed period, as one constant) · done: run by hand produces a dump and deletes nothing on fresh data
- [x] **T19** Deploy T18 as a systemd timer on the VPS; document it in `docs/security/vps.md` · done: `systemctl list-timers` shows it, one manual run succeeds
- [x] **T20** `scripts/restore-check.mjs` — **performs a restore** into a scratch database and diffs row counts plus the golden snapshot against it; add `verify:db` to `package.json` · done: `pnpm verify:db` green (**AC-6**)

## Phase 5 — verification

- [x] **T21** Full regression: `CI=true pnpm e2e` — CUJ-01, 03, 04, 05 must pass **unchanged**. Any edit to an existing CUJ assertion is a red flag, not a fix; stop and explain it · done: 84+ passing
- [x] **T22** `pnpm verify` green; `pnpm verify:db` green; commit history conventional
- [x] **T23** Measured with `scripts/measure-render.mjs`, reporting time-to-**complete** as well as first byte — TTFB alone showed the swap making the catalogue _faster_, which is an artefact: the page now suspends, so the shell leaves sooner while the visitor waits longer. `/fr/biens` full document: **33ms on fixtures → 177ms on Postgres over the SSH tunnel**. That delta is the tunnel, not the query — the same query runs in **6.4ms on the VPS itself**, and the payload is unchanged (259K → 261K, which independently corroborates AC-1). The production figure cannot be measured until the app is co-located with the database and must be re-taken then

## Phase 6 — review & ship

- [x] **T24** `/security-review` — new dependency, a new untrusted write path, PII at rest, and a new credential. Not optional here · done: APPROVE, no P1. Fixed in `d0c8e26`/`aa9b5b4` — attempts throttled as well as writes, SEC-AUTHZ-001 corrected for ADR-0008, SEC-DB-001/002 added, `getPool` un-exported. Open and the owner’s: the passphrase-less SSH key, and the forgeable `x-forwarded-for` until the app is behind Traefik
- [ ] **T25** `/review`; fix P0/P1
- [ ] **T26** `/feature-report` → `docs/reports/010-belso-data-layer.md`
- [ ] **T27** `/update-docs` — rewrite `docs/architecture/backend.md` (it documents the RLS model that no longer applies), spec index → `shipped`
- [ ] **T28** Follow-up, **not part of this spec**: delete `src/lib/supabase/`, `src/features/auth/`, `supabase/`, and the Supabase env vars. Purely subtractive, own commit, own diff

## AC coverage

Moved to [ac-coverage.md](ac-coverage.md) and corrected: the review board found two
criteria ticked on tests that could not fail, and one ticked for behaviour that did not
exist at any route. Five of eight are now qualified rather than green.
