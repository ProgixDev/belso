# Plan 011 — The client publishes a listing without a developer

- **Spec:** [spec.md](spec.md) (open questions resolved: yes — the two that remain are 012's and the privacy notice, neither of which blocks building the editor)
- **Author:** Claude (agent) · **Date:** 2026-08-29
- **Decisions:** [ADR-0010](../../docs/architecture/decisions/0010-two-database-roles.md) (two roles) · [ADR-0011](../../docs/architecture/decisions/0011-sessions-in-postgres.md) (sessions, scrypt)

## Approach

Spec 010 built a seam and proved reads pass through it unchanged. This is the opposite shape:
almost entirely new capability against existing invariants — and **three of the invariants it
needs do not exist yet.** `core/db.ts` cannot write atomically, `belso_app` cannot write at all,
and `properties.updated_at` is set once at insert and never again. Nothing here is hard once
those exist; everything here is impossible until they do. So Phase 1 is not the editor, it is
three primitives with three tests.

The second organising claim: **the back-office must not be able to break the storefront, and that
is this spec's real risk.** Every acceptance criterion is a statement about what the _public site_
shows after she clicks something. Two verified findings make that live, and both are in _Risks_ —
`/properties/[slug]` is the one storefront route with neither `force-dynamic` nor
`generateStaticParams`, and `alt[locale]` is read by index with no fallback.

The trade-off taken throughout is **more Postgres, fewer packages.** Sessions are a table, not
`next-auth`. Passwords are `node:crypto.scrypt`, not a native argon2. The login limiter is the
enquiry limiter's shape against its own table. Spec 011 adds **no npm dependencies** except
`sharp`, which AC-6 cannot be done without.

### The five blockers, decided

**1. Transactions, without re-opening the pool.** `core/db.ts` gains `editorTransaction(run)`, and
the callback receives a **narrow `Tx` with exactly one method — `query(text, values)`** — not a
`PoolClient`. That is the point: handing out a client would restore
`client.query(\`…${input}\`)`, the single line `getPool`'s privacy exists to remove. `Tx`preserves the property by construction rather than by comment.`BEGIN`/`COMMIT`/ rollback in
its own try-catch (a failing rollback must not mask the original error) /`release()`in`finally`.

**2. Error codes, without changing the public site.** `PostgresError extends
DatabaseUnavailableError`, carrying `code`, `constraint`, `detail`. Thrown when the driver error
has a five-character SQLSTATE; the plain `DatabaseUnavailableError` otherwise (`ECONNREFUSED` is
a Node errno, not a SQLSTATE). **Subclassing is the decision, not a detail** — every existing
`instanceof DatabaseUnavailableError` keeps matching, so the catalogue's outage page and
`e2e/db-down.spec.ts` behave exactly as today, while the editor can narrow to `code === "23505"`
to say "that address is already taken". A sibling class would have turned today's honest outage
page into a 500 for any SQL error, which is a public-site change in a spec that promised none.

**3. Two roles.** [ADR-0010](../../docs/architecture/decisions/0010-two-database-roles.md).
`editorQuery` / `editorTransaction` are separate exported names, never a privilege flag with a
default. `DATABASE_EDITOR_URL` **must not fall back** to `DATABASE_URL`.

**4. Reordering: make the constraint deferrable.** Migration 0005 re-creates
`unique (property_id, position)` as `deferrable initially immediate`; the reorder runs
`set constraints all deferred` inside one transaction and issues N updates, checked once at
commit. Rejected: a negative-offset two-pass (works, doubles the writes, reads as a workaround for
a constraint we own); and **delete-then-reinsert, which is actively dangerous** —
`property_media_alt` cascades on delete, so it would silently destroy every alt text, the one
field the spec says this site has already been burned by.

**5. The gate is the layout and every action — not the proxy.** `src/proxy.ts` declares no
runtime, so it runs on Edge where `pg` cannot open a socket; the session check its own comment
invites is impossible there. So: the proxy checks cookie **presence** for a fast redirect and
nothing more; `app/(system)/admin/layout.tsx` is the authority for navigation; and
**`requireSession()` is the first statement of every admin action**, because a Server Action is an
independently addressable endpoint and "the layout checked" is not a check for a layout that never
rendered. AC-1 asserts both halves.

### Where the code lives

`features/admin` owns **auth and chrome only** — accounts, sign-in, the login throttle, the admin
nav. It knows nothing about properties, which is why it can be thin.

Property writes live in `features/properties`, beside `repository.ts`, because that slice owns the
domain and features may not import features.

**`requireSession` cannot live in either**, because `features/properties`' actions must authorise
themselves and cannot import `features/admin`. It goes in **`src/core/session.ts`** — the
precedent is verbatim in `core/i18n.ts`: "this lives in `core` because `proxy.ts` needs it and the
boundary rules forbid importing a feature from there."

**The throttle is not promoted to `core`.** The plan file's earlier draft said it should be, on
the "second consumer" rule. That is wrong here: the two limiters share a six-line upsert and
nothing else — different keys, different limits, different tables, and critically **different
grants**, since `belso_app` must write the enquiry counter and must never touch the login one. A
shared helper parameterised by table name would interpolate that name into SQL, in the one file
that exists to forbid string-built SQL. Six duplicated lines beat that.

### Optimistic locking: a `version` integer, not `updated_at`

`properties.updated_at` has `default now()` and **no update trigger**, so it is the creation time
forever. That breaks AC-10 (nothing to compare) _and_ the spec's own "most recently changed
first".

Migration 0005 adds `version integer not null default 1` plus **three triggers**: `before update`
on `properties`, and `after insert/update/delete` on `property_translations` and `property_media`
that touch the parent — otherwise adding English or reordering photographs leaves the listing at
the bottom of her own list.

`version` rather than `updated_at` because a `timestamptz` round-trips through a form as a
formatted string, and text-comparing timestamps across a post is a bug class this repo has already
been bitten by twice (`row.ts` casts `date` to text for exactly this reason). The save is
`update properties set …, version = version + 1 where id = $1 and version = $2 returning id` as
the **first statement in the transaction**, so it takes the row lock before any child write. Zero
rows → `{ ok: false, formError: "staleEdit", values }`, her text echoed back.

### Media

Stored URL is **`/media/<mediaId>.webp`** — same-origin and relative, so `remotePatterns` is
irrelevant and `img-src 'self'` already covers it. **Not `public/uploads/`**: `public/` is build
output, so a deploy that replaces the app directory destroys every photograph she uploaded. Files
live under `MEDIA_ROOT`, a bind-mounted volume outside the app, served by a route handler at
`app/(system)/media/[...file]/route.ts` with an immutable cache header (filenames are
content-identified). Path traversal is that handler's entire attack surface and gets its own test.

Upload writes the untouched original plus one **display master capped at 2560px, WebP**, whose
real dimensions fill the `NOT NULL` width/height. `next/image` stays and now downsizes from 2560px
instead of a 6000px camera file. Two things bite: Server Action bodies default to 1MB and camera
originals are 10–40MB, so `serverActions.bodySizeLimit` must be raised and size plus **magic
bytes** validated server-side (`file.type` is attacker-controlled); and **EXIF must be stripped**,
because a photograph of a villa carries its GPS coordinates and this product deliberately
publishes only approximate district positions.

## Placement

| What                                | Where                                                              | Notes                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Editor pool, `Tx`, `PostgresError`  | `src/core/db.ts`                                                   | `getPool` stays private; `Tx` exposes one text/values method and nothing else                        |
| `DATABASE_EDITOR_URL`, `MEDIA_ROOT` | `src/core/env.ts`                                                  | Blank-is-unset. **No fallback** to `DATABASE_URL`                                                    |
| Session primitive                   | `src/core/session.ts` **(new)**                                    | Cookie name/attributes, `createSession`, `currentSession`, `requireSession`, `endSession`            |
| Route gate (presence only)          | `src/proxy.ts`                                                     | `/admin` into `UNLOCALISED_PREFIXES`; imports one constant from `core`                               |
| Auth + admin chrome                 | `src/features/admin/` **(new)**                                    | `/new-module`. Knows nothing about properties                                                        |
| Property writes                     | `src/features/properties/writes.ts` **(new)**                      | All mutating SQL, beside `repository.ts`. `editorTransaction` only                                   |
| Property write actions              | `src/features/properties/admin-actions.ts` **(new)**               | `"use server"`; `requireSession()` is line one of every export                                       |
| Editor UI                           | `src/features/properties/components/property-editor.tsx` **(new)** | Per-locale field groups; copied from `enquiry-form.tsx`                                              |
| Image pipeline                      | `src/features/properties/media.ts` **(new)**                       | sharp, `server-only`                                                                                 |
| Routes                              | `src/app/(system)/admin/**`                                        | Inherits `lang="en"` + `robots: noindex`; composes two slices, holds no logic                        |
| Media serving                       | `src/app/(system)/media/[...file]/route.ts` **(new)**              | Traversal-guarded, immutable cache                                                                   |
| Migrations                          | `db/migrations/0005_*.sql`, `0006_*.sql`                           | 0005: accounts, sessions, throttle, `version`, triggers, deferrable uniqueness. 0006: `belso_editor` |
| Account admin                       | `scripts/admin-user.mjs` **(new)**                                 | Owner over SSH, like `migrate.mjs`                                                                   |
| New primitives                      | `src/components/ui/{textarea,select}.tsx`                          | `/new-component`. **No dialog, table or toast** — see Risks                                          |

## Data & state

Three new tables (`admin_users`, `admin_sessions`, `admin_login_throttle`) and four alterations:
`properties.version`; a touch trigger on `properties`; parent-touching triggers on the two child
tables; `property_media`'s unique constraint re-created deferrable.

Two points easy to get wrong:

- **French-required is a publish-time rule, not a schema rule.** `property_translations` is
  unchanged — a missing locale is a missing row, which is what makes AC-3b work at all. So a draft
  may have zero translations, and `publishAction` runs a **stricter zod schema** than `saveAction`.
  AC-3's "the missing fields are named" is that schema's issue list, and — like
  `enquiries/types.ts` — **the messages are error keys, never sentences**, even though the admin
  chrome is English-only. The moment one is a sentence the pattern is dead for the next author.
- **Untranslated is derived, never stored.** "French-only" in her list is
  `not exists (select 1 from property_translations where locale = 'en')`, computed per read. A
  stored flag is how AC-3b breaks: she adds English, the flag is stale, the note stays until
  someone republishes — exactly what AC-3b forbids.

**Client state: almost none.** Lists and filters are `searchParams`. One genuine store: the
gallery's pending order and per-file upload progress, which is not URL-shaped and must survive a
failed submit — a per-request factory + provider like `task-list/`.

**Actions** follow `enquiries/actions.ts` exactly, plus two additions this spec forces:
`requireSession()` first, and a `formError: "staleEdit"` arm. On success, `revalidatePath` for the
affected storefront routes — see Risks; this is the difference between AC-3 passing and AC-3
lying.

## Acceptance criteria → verification

| AC             | Proven by                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1**       | unit: `proxy.test.ts` — no cookie on `/admin/listings` → 307 to sign-in; a `next` of `//evil.com` is discarded · unit: **every exported action** with no session returns unauthorised and issues zero statements (a pool spy asserts it) · e2e: signed out, request `/admin/listings` and **grep the body for a known listing title** — "no data in the response" is the criterion, not "a redirect happened" |
| **AC-2**       | db: a `draft` is absent from all six `repository.ts` functions · e2e: extend `e2e/draft-listing.spec.ts` with a draft _she_ made, reusing its existing sitemap and 404 assertions                                                                                                                                                                                                                             |
| **AC-3**       | unit: publish schema — French-only passes; missing `fr.title` fails and the issue names it · e2e (**CUJ-06**): create → French only → publish → `/fr/biens/<slug>` renders French, `/en/properties/<slug>` renders French **with the untranslated note** · e2e negative: empty `fr.description` → stays draft, field named on screen                                                                          |
| **AC-3b**      | db: adding `en` leaves `publication` untouched and `isFallback` false · e2e: the note disappears and **the French page's HTML is byte-identical before and after**                                                                                                                                                                                                                                            |
| **AC-4**       | db: archived absent from `listProperties`, present by direct query, child row counts unchanged · e2e: gone from `/fr/biens`                                                                                                                                                                                                                                                                                   |
| **AC-5**       | db: updating the slug through `writes.ts` fills `property_slug_history` **without the application writing it** — the test exists to catch a future refactor to delete-and-reinsert, which would stop the trigger firing · e2e: the old URL redirects                                                                                                                                                          |
| **AC-6**       | unit: a 6000px fixture yields a ≤2560px WebP, original byte-identical on disk, **EXIF absent** · unit: `../../etc/passwd` and an encoded variant both refused · e2e: the `<img src>` resolves 200 and is smaller than the original                                                                                                                                                                            |
| **AC-9**       | unit: the 11th attempt on one email is refused, and the 21st from one network is refused **across different emails** · unit: unknown email and wrong password return the identical object, **and the unknown path still calls the verifier** (spy) so timing does not separate them · e2e: same message either way                                                                                            |
| **AC-10**      | db: two saves from one `version` — second gets `staleEdit`, first's values survive · db: **concurrent** — two transactions open before either commits, exactly one wins (the sequential test cannot catch this, and it is why the version check is the transaction's first statement) · e2e: two contexts, second sees the message with its text intact                                                       |
| **regression** | `CI=true pnpm e2e` — CUJ-01/03/04/05 unchanged · `repository.golden.test.ts` still byte-for-byte, which is the guard on the alt-fallback change                                                                                                                                                                                                                                                               |

## Risks & unknowns

- **`/properties/[slug]` is not `force-dynamic` and has no `generateStaticParams`.** Every other
  catalogue-backed route got one in spec 010; this one did not. In production Next renders it on
  demand and holds it in the full route cache, so **publishing may not make anything appear**, and
  AC-3/3b/4/5 would pass at the repository layer while failing in a browser. This is 010's P0
  recurring one route over. Every write action calls `revalidatePath` for both locales, the
  catalogue, the district page and the sitemap — and the e2e for those ACs must run against
  `pnpm build && pnpm start`, not `next dev`, or it cannot see the bug it exists to catch.
- **`alt[locale]` has no fallback, and this spec is what breaks it.** `property-card.tsx:175`
  reads `cover.alt[locale]` by index; every seeded row has both locales so it has never fired. The
  first photograph she captions in French only puts `alt={undefined}` on the **English public
  site** — an a11y regression caused by the feature meant to stop alt text being an afterthought.
  Fix in the mapper: `alt[locale] ?? alt[defaultLocale] ?? ""`, with `PropertyMedia.alt` retyped
  `Partial<Record<Locale, string>>`. It touches a public-site file, so the golden snapshot is the
  guard.
- **The editor is one form with two languages, and that is the shape most likely to go wrong.**
  An empty English group must produce **no `property_translations` row at all**, not a row of
  empty strings — an empty-string translation satisfies `resolveTranslation`, kills the fallback,
  and shows a blank English page where the honest note belongs. That is AC-3b failing while every
  test that only checks `publication` passes.
- **The UI kit is missing more than it looks**: no textarea, select, dialog, table, toast or tabs.
  Two are genuinely needed. The rest are avoidable and should be avoided — the listings list is a
  `<ul>` of cards, not a table; "confirm archive" is a form with a second submit, not a dialog;
  "saved" is a `role="status"` region, not a toast. Four new primitives to build one screen is how
  a UI kit becomes a design system nobody agreed to.
- **`sharp` on two shared cores.** Resizing is bounded, but fifteen photographs is fifteen of
  them. Sequential, not `Promise.all`, or one save starves the site.
- **`MEDIA_ROOT` has no deploy story**, because the app is not deployed yet — 010 put the database
  on the VPS and left the app where it was. The volume decision belongs to the deploy spec; until
  then it is a local directory and that is honest rather than finished.
- **`public/` is not gitignored** — `public/uploads/` would have committed the client's
  photography. Moot now that media lives under `MEDIA_ROOT`, but worth an ignore entry anyway.
- **Two connection strings is a new operational failure mode.** A deploy that sets `DATABASE_URL`
  and forgets `DATABASE_EDITOR_URL` leaves a perfect-looking site and an unusable back-office.
  `env.ts` says so loudly on boot in production — a log, not a throw: the storefront is fine and
  must keep serving.
- **`e2e/db-down.spec.ts` is the regression test for blocker 2** and must be _run_, not assumed.
  Reclassifying errors by SQLSTATE is a one-line change with a public blast radius.

## Overlap check

Active specs: **010 is shipped** (`0d9b05e`, report filed; T28 landed as `f67ef86`) and **009 is
closed**. Nothing is in flight, and no other spec touches `core/db.ts`, `proxy.ts` or
`features/properties`.

The real overlap is with **010's own guarantees**, not with a spec: `repository.golden.test.ts`,
`e2e/db-down.spec.ts`, `e2e/draft-listing.spec.ts` and `scripts/restore-check.mjs` are all
assertions this spec can break, and three of them it deliberately touches. Each is named in the AC
table rather than left to be found in review.

One sequencing constraint, and it is the whole reason for the phase order: **the editor must not
be built before 0005 and 0006 apply and `editorTransaction` has its own test.** Building against
`query()` and retrofitting transactions later means rewriting every write path — and the ones that
are not rewritten are the ones that leave a listing with translations and no media after a failed
save.
