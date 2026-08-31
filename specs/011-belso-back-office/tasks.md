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

- [ ] **T24** `CI=true pnpm e2e` — CUJ-01/03/04/05 **unchanged**; any edit to an existing CUJ assertion is a red flag, not a fix
- [ ] **T25** `pnpm verify` green; `pnpm verify:db` green against `belso_test`; screenshots captured to `artifacts/screenshots/011-belso-back-office/` and **looked at**
- [ ] **T26** Register **CUJ-06**; measure the editor's save time against the two-core box rather than assuming it

## Phase 6 — review & ship

- [ ] **T27** `/security-review` — a new auth surface, a new credential, file upload, and PII. Not optional
- [ ] **T28** `/review`; fix P0/P1
- [ ] **T29** `/feature-report` → `docs/reports/011-belso-back-office.md`
- [ ] **T30** `/update-docs` — `backend.md` gains the roles and sessions; **reconcile `/plan.md`**, which still promises this work as `specs/003-belso-backoffice` with self-hosted Supabase; spec index → shipped

## AC coverage

Mirrors [plan.md](plan.md). Kept honest: a criterion is ticked only when a test exercises it **at
the altitude the criterion is written at** — the lesson from spec 010's
[ac-coverage.md](../010-belso-data-layer/ac-coverage.md), where three were ticked on tests that
could not fail for the right reason.

- [x] AC-1 → T12 · [x] AC-2 → T20 · [x] AC-3 → T15, T20 · [x] AC-3b → T18, T20
- [x] AC-4 → T20 · [x] AC-5 → T20 · [x] AC-6 → T21, T22, T23 · [x] AC-9 → T8, T12 · [x] AC-10 → T14
