# Tasks 011 — The client publishes a listing without a developer

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and
never reorders silently. `[P]` marks tasks safe to parallelize.

**The order is not the obvious one.** Three primitives the editor needs do not exist —
transactions, a write role, and a `version` to lock against — and building the editor first means
rewriting every write path when they arrive. Phase 1 is those three, each with its own test.

## Phase 0 — decide and split

- [x] **T0** ADR-0010 (two roles) and ADR-0011 (sessions, scrypt). Narrow spec 011 to nine ACs; create `specs/012-belso-inbox/` carrying the inbox and the notification · done: both ADRs indexed, `pnpm check:docs` green
- [x] **T1** Branch `feat/011-back-office` off the spec; confirm `pnpm verify` and `pnpm test:db` green before touching anything · done: both green on a clean tree

## Phase 1 — the three missing primitives (nothing else can be built first)

- [x] **T2** `core/db.ts`: `editorQuery`, `editorTransaction(run: (tx: Tx) => …)` where **`Tx` exposes only `query(text, values)`** — never a `PoolClient`, or `getPool`'s privacy is undone. Rollback in its own try/catch; `release()` in `finally` · done: `db.test.ts` proves a thrown callback rolls back and a failing rollback does not mask the original error
- [x] **T3** `core/db.ts`: `PostgresError extends DatabaseUnavailableError` with `code`/`constraint`, thrown only for a five-character SQLSTATE · done: unit test on both shapes, **and `e2e/db-down.spec.ts` still passes** — the subclass exists so that stays true
- [x] **T4** `db/migrations/0005_admin_and_versioning.sql`: `admin_users`, `admin_sessions`, `admin_login_throttle`; `properties.version`; touch trigger on `properties`; parent-touching triggers on `property_translations` and `property_media`; `property_media` unique constraint re-created **deferrable** · done: applies clean, and editing a translation bumps the parent's `version`
- [x] **T5** `db/migrations/0006_editor_role.sql`: `belso_editor` + grants, **including `property_slug_history`** (the slug trigger has no `SECURITY DEFINER`, so it runs as the invoker) · done: proven by attempting the escalations as the role, the way 0004 was
- [x] **T6** `DATABASE_EDITOR_URL` and `MEDIA_ROOT` in `env.ts`, blank-is-unset, **no fallback to `DATABASE_URL`**; loud production log if the editor URL is missing · done: `pnpm verify` green with and without them
- [x] **T7** `core/session.ts`: cookie contract, `createSession`, `currentSession`, `requireSession`, `endSession`. Token is 32 random bytes; the row is keyed by its SHA-256 · done: unit test proves the raw token is never stored

### What Phase 1 turned up

Three things worth carrying forward, none of them in the plan:

- **`editorTransaction` must not convert the callback's own error.** The first version funnelled
  everything from its `catch` through the error converter, so a write throwing `ConcurrentEditError`
  to force a rollback — the AC-10 pattern, T14 — would have reached the client as “the database is
  not reachable”. Statements convert where they are issued (`Tx.query`); the wrapper rethrows
  untouched. Pinned by identity, not message, in `db.test.ts`.
- **The 0006 grants are now a test**, `db/checks/role-grants.sql` run by
  `src/core/role-grants.db.test.ts`. ADR-0010 called the grant list a specification; this makes it
  one. Confirmed it fails — a temporary `grant select on admin_users to belso_app` turns the suite
  red with `ESCALATION — read password hashes`. The failure it guards is not a deliberate bad
  grant but a future migration reflexively writing `grant all on all tables`.
- **`belso_test` was rebuilt from zero.** It carried 0004's pre-fix checksum, so `db:migrate`
  refused it — the guard working correctly on a scratch database whose history had drifted from
  production's. Rebuilding also proved all six migrations apply from nothing.

Also done here because it was already wrong: `.env.example` documented the Supabase variables as
“still parsed by `src/core/env.ts`”, which stopped being true when `f67ef86` deleted them, and it
never listed `THROTTLE_SECRET`.

## Phase 2 — the gate (AC-1, AC-9)

- [x] **T8** `features/admin` via `/new-module`: `password.ts` (scrypt, with a **dummy verify on unknown email** so timing does not leak), `login-throttle.ts` (by network _and_ by email), `actions.ts` · done: unit tests for both throttle axes and identical responses for unknown-email vs wrong-password
- [x] **T9** `/admin` into `UNLOCALISED_PREFIXES`; **cookie-presence** redirect in `proxy.ts`; `?next=` validated against `/^\/admin(\/|$)/` · done: `proxy.test.ts` covers the redirect and rejects `//evil.com`
- [x] **T10** `app/(system)/admin/layout.tsx` — the authoritative gate — plus sign-in page and admin nav. Add `/admin` to `robots.ts` · done: signed out, every `/admin` path redirects
- [x] **T11** `scripts/admin-user.mjs` (create / set password / disable) and `scripts/vps/belso-roles.sh`, which also closes migration 0004's dangling reference to a script that never existed · done: an account can be created and signed in with
- [x] **T12** `e2e/admin-auth.spec.ts` — **both halves of AC-1**: a signed-out GET redirects with no listing title in the body, and a signed-out POST to an action is refused and writes nothing · done: green (**AC-1**, **AC-9**)

### What Phase 2 turned up

- **The gate lives in a new `(admin)` root group, not under `(system)`.** `(system)` renders
  `RootShell lang="en"`, and `<html lang>` belongs to whichever root layout owns the tree — a
  nested layout cannot change it. Under `(system)` every French page of the back-office would
  announce itself as English. `root-shell.tsx` already explains why there are two roots; this is
  the same argument for a third.
- **A grant comment that flattered itself.** Migration 0006 withheld `delete` on
  `admin_login_throttle` and said that stops the counter being reset — but counting needs
  `update`, and an `update` can set a count to zero just as well. The comment now says what is
  actually true, and `clearLoginAllowance` zeroes rather than deletes so it needs no grant the
  counting does not already have. 0006 was corrected in place rather than superseded: it has only
  ever been applied to the scratch database and the branch is unpushed, so it is a draft, not
  history.
- **`belso_app`'s password was already set on the server**, by something this session did not
  record — so `belso-roles.sh` takes a role argument and Phase 2 provisioned `belso_editor` alone.
  Rotating `belso_app` would invalidate whatever the deployed storefront is holding, and the
  failure would not appear until the next process start. **Worth the owner rotating deliberately.**
- **`pnpm e2e` was not repeatable within an hour.** The suite submits the enquiry form four times
  against a five-per-hour throttle, and a local run has no forwarding header so every request
  counts into one bucket — the second run of the day failed with the form reporting a throttle,
  which reads as a broken enquiry form and is the limiter working. `e2e/global-setup.ts` clears
  the limiter tables, on a `_test` database only.
- **The proxy gate is GET-only, deliberately.** A signed-out POST is allowed to reach the action so
  that the action refuses it. Redirecting it in the proxy would make the AC-1 e2e pass while
  proving nothing about whether the action checks — which is the half that ships open.

## Phase 3 — the editor (AC-2, AC-3, AC-3b, AC-4, AC-5, AC-10)

- [x] **T13** Fix `alt[locale]` to fall back before anything writes a French-only caption: `Partial<Record<Locale,string>>`, `alt[locale] ?? alt[defaultLocale] ?? ""` · done: **`repository.golden.test.ts` still byte-for-byte** — it is the guard on a public-site file
- [x] **T14** `properties/writes.ts` — create, save, publish, archive, rename — all through `editorTransaction`, version check as the **first statement** · done: `writes.db.test.ts` including the concurrent case (**AC-10**)
- [x] **T15** `properties/admin-actions.ts` — `requireSession()` as line one of every export; publish runs a **stricter zod schema** than save; messages are error keys, never sentences · done: `admin-actions.test.ts` (**AC-3** validation half)
- [x] **T16** `revalidatePath` on every successful write, for both locales' listing URL, the catalogue, the district page and the sitemap. **And give `/properties/[slug]` the freshness declaration spec 010 missed** · done: publishing makes the page appear under `pnpm start`, not just `next dev`
- [x] **T17** `textarea.tsx` and `select.tsx` via `/new-component`; no dialog, table or toast · done: both have tests, both used by the editor
- [x] **T18** `property-editor.tsx` — per-locale field groups; an empty English group writes **no row**, not empty strings · done: `editor.test.tsx` proves the empty group is absent (**AC-3b**)
- [x] **T19** Listing list and detail routes under `app/(system)/admin/listings/`, French-only marked visibly · done: `loading.tsx` and `error.tsx` present, states screenshotted
- [x] **T20** e2e for the editor: draft invisible, publish, add English later, archive, rename · done: green (**AC-2, AC-3, AC-3b, AC-4, AC-5**)

### What Phase 3 turned up

Three defects, and **two of them were found by looking at a screenshot rather than by a test**:

- **Creating a listing left her on a cleared form.** The action returned `{ ok: true }` and the
  page still said “Nouveau bien” with “Enregistré.” beside the button — which reads as a failure,
  and whose obvious response, pressing the button again, makes a second listing. It redirects to
  the new listing now.
- **The selects were indistinguishable from text inputs.** The chevron was a Tailwind arbitrary
  value containing an inlined SVG, and Tailwind treats a space in an arbitrary value as the end of
  the class, so the rule was never emitted. Nothing on screen said “Quartier” was a dropdown.
- **The “En ligne” link read `/fr/fr/properties/…`.** `toPublicPath` adds the locale itself and I
  passed one in. It rendered, looked right, and would have 404d for anyone who clicked it.

And one test that was worse than no test. The e2e asserted the listing's heading straight after
clicking that link — but the **admin page's own `h1` is the listing title too**, so it matched the
page it had not left, passed instantly, and let the following `page.goto` race the navigation still
in flight (`net::ERR_ABORTED`, roughly one run in twenty). It could not have caught the doubled
locale either. The link's `href` is now read and asserted, then navigated to; clicking was abandoned
because the publish action re-renders the tree and a click can land on an element React is replacing.

## Phase 4 — photographs (AC-6)

- [x] **T21** `sharp` added; `properties/media.ts` — original written untouched, one ≤2560px WebP master, real dimensions recorded, **EXIF stripped**, processed sequentially · done: `media.test.ts` on a real 6000px fixture
- [x] **T22** `app/(system)/media/[...file]/route.ts` — segment allow-list, `path.resolve` + `startsWith(MEDIA_ROOT)`, immutable cache · done: traversal test refuses `../../etc/passwd` and its encoded form
- [x] **T23** Upload UI, reorder (**deferred constraint inside one transaction**), per-locale alt text; `serverActions.bodySizeLimit` raised; size and **magic bytes** checked server-side · done: fifteen photographs upload and reorder (**AC-6**)

### What Phase 4 turned up

- **A version threaded through state instead of a ref.** Every action in the gallery moves the
  listing's version, and `run` read it from the render's closure — so uploading fifteen
  photographs sent the same version fifteen times: the first succeeded, the second was refused as
  a concurrent edit, and she was told somebody else had changed the listing while the somebody
  else was her own previous upload. One photograph in, fourteen silently abandoned.
- **The gallery swallowed every failure.** These actions are called from event handlers, not from
  a `<form action>`, so nothing above them catches a rejection — an error became an unhandled
  promise rejection and the interface did nothing at all, for ever, with no message and no server
  log. That is precisely how the first end-to-end run failed.
- **A caption saved with no signal.** She typed one, clicked away, and nothing on screen said it
  had been kept. It says "Enregistré." now — though the end-to-end test waits on the database
  rather than on that message, because the flag stays true from the previous action and after
  fifteen uploads it is already on screen.
- **`/media/` is gitignored.** The e2e suite alone writes fifteen files into `MEDIA_ROOT` on every
  run, and the client's real photography must never enter the repository. Flagged in the plan's
  risks; it would otherwise have been found by a commit.

**And a mistake of mine worth recording.** Checking whether `set constraints … deferred` was
load-bearing, I removed it, watched the reorder fail with `23505` — and my restore landed in the
wrong place, because prettier had reformatted the statement I was matching on. The reorder stayed
broken. I spent a long time diagnosing the browser test, concluded it was Playwright racing
React's re-render, and had written that into a comment before `pnpm test:db` caught the real
cause. The lesson is not "be careful with string replacement": it is that a load-bearing check
should be re-run immediately after being restored, not at the end of the phase.

## Phase 5 — verification

- [x] **T24** `CI=true pnpm e2e` — CUJ-01/03/04/05 **unchanged**; any edit to an existing CUJ assertion is a red flag, not a fix · done 31/08: 95 passed, 3 skipped (`db-down`, which wants `DB_DOWN=1`), 0 failed. No CUJ assertion was touched
- [x] **T25** `pnpm verify` green ✓; `pnpm verify:db` green ✓ against `belso_test`; screenshots ✓ captured to `artifacts/screenshots/011-belso-back-office/` and looked at · closed 01/09 once production was migrated — see below

### Production was migrated to 0006 on 01/09

`db:restore-check` failed for a fortnight-shaped reason: `0005` and `0006` had been applied to
`belso_test` and never to `belso`, which still sat at `0004`. The check restores the newest live
dump and runs the site's own golden snapshot against the copy, so it failed on
`column p.version does not exist` — and that column is selected in `row.ts`, the one query **every
public read** goes through. Deploying spec 011 before this would have returned 500 on every
catalogue page, every listing and every district, not merely on `/admin`.

Applied after a fresh dump (`belso-20260901-122026.dump`), with the row counts recorded either
side: **20 properties, 39 translations, 149 photographs, 0 enquiries, 0 slug history — identical
before and after.** Both migrations are additive; the only non-additive statement is
`property_media`'s unique constraint being recreated as `deferrable initially immediate`, inside
the migration's own transaction.

`belso_editor` now exists on production **with no password**, exactly as `0006` intends: the role
cannot authenticate until `scripts/vps/belso-roles.sh` provisions one. That is a deploy-time step
and deliberately not done here — the credential belongs in the deployment's configuration, not in
a transcript.

`pnpm verify:db` is green end to end for the first time: migrate, seed, 47 database tests, and a
restore whose oracle is the site's own catalogue query rather than a row count.

- [x] **T26** Register **CUJ-06**; measure the editor's save time against the two-core box rather than assuming it · done 31/08 — CUJ-06 was already registered; the measurement is below and repeatable as `pnpm measure:upload`

### T26 — what the editor actually costs

Measured, not assumed, with `scripts/measure-upload.mjs`:

|                   | per photograph    | gallery of fifteen |
| ----------------- | ----------------- | ------------------ |
| this machine      | **381 ms** median | 5.5 s of CPU       |
| VPS, projected    | ~460 ms           | ~6.7 s             |
| **VPS, measured** | **568 ms** median | **8.5 s**          |

The projection used `openssl speed -evp sha256` on both sides — 2,176,622k here
against 1,776,877k on the VPS at 16 KB blocks, a single core about 1.2x slower.

**The real number arrived on 01/09** (spec 013, T-19), once there was a
deployment to run it in: 568 ms median, slowest 597 ms, on a box at 0.21 load.
The projection was **24% optimistic** — the ratio said 1.2x and the truth was
1.5x, because SHA-256 is hardware-accelerated on both sides and an image codec
is not. Worth remembering the next time a CPU ratio is used to scale a
workload it does not resemble.

Still a floor rather than a promise: the two cores are shared with Postgres and
the client's n8n, and this was measured while nobody was using the site.

**The risk `plan.md` flagged is real and modest**, and the measured number does
not change that. Photographs are uploaded one per submission, so a full gallery
is fifteen separate requests of a little over half a second each, not one
nine-second wait. That is comfortable. What would not be
comfortable is batching them into a single submission, which is worth knowing
before somebody improves the upload form.

**Two measurement traps paid for here, so they are not paid for twice.**

The first fixture was `sharp({create})` with a flat background, copied from
`media.test.ts` where it is entirely correct — that file asserts on dimensions
and EXIF and does not care about pixels. It reported **205 ms**, and it is a
best case the product never produces: a solid colour compresses to a tenth of a
megabyte and both decode and encode finish early. Real photographic content
nearly doubled the number. A performance fixture has to be representative in the
dimension being measured, and for a codec that dimension is entropy, not size.

The CPU ratio was first taken with `dd | sha256sum`, which reported the VPS at
less than half the local wall clock — not credible, and it is not measuring the
processor: on Windows it measures Git Bash's pipe and process overhead. A
benchmark that runs inside one process is the point.

### What phase 5 turned up

**Production is two migrations behind the code, and `db:restore-check` is what found it.**
`db/migrations/0005` and `0006` were applied to `belso_test` and never to `belso`, which still
sits at 0004. The check restores the newest live dump and runs the site's own golden snapshot
against the copy; it failed on `column p.version does not exist`. That column is selected in
`row.ts` — the one query **every public read** goes through — so deploying this spec against
production as it stands would 500 the whole storefront, not only the back-office, and
`belso_editor` would not exist to connect with either. The backup itself is healthy: the dump
restored and every table matched. Comparing row counts would have printed a tick, which is the
argument for running a real query that the script's own docstring makes.

`pnpm verify:db` stayed red at its last stage until production was migrated on 01/09; it is green
now, and the account of that sits under T25 above.

**Nothing warns that a photograph has no description.** `publishableSchema` requires the
reference, the price, the built area and the French title, description, district, city and slug —
and says nothing about alt text. The editor shows fifteen photographs with empty description
fields and publishes them without comment. The spec calls this the field most likely to be
skipped, and the one the site has already been burned by, and then nothing in the product acts on
that. No acceptance criterion requires it, so this is a gap between the spec's stated concern and
what shipped rather than a defect against a criterion — but it is what looking at the screenshots
produced, and it should reach `/review`.

**Reordering fifteen photographs is fourteen clicks.** Ordering is one-step up/down buttons per
row, so moving the last photograph to the front means fourteen separate saves. `plan.md` phase 2
asked for drag-to-reorder. Not a defect against any criterion — AC-6 only says she orders them —
and worth putting in front of the person who will do it fifteen times per listing.

**The screenshot recipe in T25 does not capture this feature.** `pnpm e2e:shots` runs
`--grep @cuj`, and only one test in `listing-editor.spec.ts` carries the tag, so it produces
`60-` alone. The other ten shots (`50-52`, `61-67`) live in untagged tests and need the two admin
specs named directly with `FEATURE` set.

## Phase 6 — review & ship

- [x] **T27** `/security-review` — a new auth surface, a new credential, file upload, and PII. Not optional · done 31/08: APPROVE, no P1. Three P2s fixed on `fix/011-security-review`; CSP enforcement (SEC-NET-002) deferred to the deploy
- [x] **T28** `/review`; fix P0/P1 · done 01/09: four lenses, eleven findings, two P0s. All P0 and P1 closed; the declined and deferred ones are in the report's follow-ups
- [x] **T29** `/feature-report` → [`docs/reports/011-belso-back-office.md`](../../docs/reports/011-belso-back-office.md) · done 01/09, with the eleven screenshots curated into the report folder and linked from `specs/README.md`
- [x] **T30** `/update-docs` · done 01/09 — [`docs/product/features/back-office.md`](../../docs/product/features/back-office.md) written; `backend.md` gains the editor role and a section on sessions it had never had; CUJ-06 now names both e2e specs and both screenshot ranges; spec index and this spec’s own status → shipped. `plan.md` was reconciled on 31/08 in its own commit. The feature index also gained the public storefront, which had shipped in August and was never listed.

## AC coverage

Mirrors [plan.md](plan.md). Kept honest: a criterion is ticked only when a test exercises it **at
the altitude the criterion is written at** — the lesson from spec 010's
[ac-coverage.md](../010-belso-data-layer/ac-coverage.md), where three were ticked on tests that
could not fail for the right reason.

- [x] AC-1 → T12 · [x] AC-2 → T20 · [x] AC-3 → T15, T20 · [x] AC-3b → T18, T20
- [x] AC-4 → T20 · [x] AC-5 → T20 · [x] AC-6 → T21, T22, T23 · [x] AC-9 → T8, T12 · [x] AC-10 → T14
