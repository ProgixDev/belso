# Backend (Postgres, on our own VPS)

The backend is **Postgres on a VPS the client owns** ([ADR-0008](decisions/0008-postgres-on-our-own-vps.md),
which supersedes 0007). Golden rule: **no browser ever holds a database credential.** Every read
goes through a `server-only` repository, and the authorization boundary is that the app is the
only thing with a connection — not Row-Level Security, which the previous design relied on and
this one does not have.

> This document described Supabase and an RLS-first model until 2026-08-28. If you are reading a
> cached copy, or code that imports `@/lib/supabase/*`, that is the old design: those files are
> due for deletion (spec 010, T28) and nothing in the storefront imports them.

## Why not RLS

RLS earns its keep when an untrusted browser talks to the database directly, holding a public
key. Belso has no such browser. The public reads published listings; two or three people at the
agency write them. There is no per-user row ownership and no multi-tenant boundary, so RLS would
have guarded a door nobody walks through — at the cost of a policy on every table, each of which
is a chance to get it subtly wrong.

What replaces it is narrower and easier to check: **one filter, in one place.**

## The pieces

- **`src/core/db.ts`** — the connection pool and `query(text, values)`. `getPool` is deliberately
  **not exported**: `query` taking text and values separately is the control, and one
  `getPool().query(\`…\${input}\`)` would undo it. Module-level rather than per-request, unlike a
  Zustand store — a pool holds no request state, and one per request would exhaust Postgres
  within a page load.
- **`src/features/properties/row.ts`** — SQL rows back into the domain, and the one `select` that
  every public read goes through. `numeric` arrives as a string, `date` must not become a `Date`,
  and a missing translation is a missing key: all three are documented there because all three
  have been bugs.
- **`src/features/properties/repository.ts`** — the seam. **Every public read filters
  `publication = 'published'`** inside `row.ts`, once, never at a caller: AC-2 names five entry
  points a draft must not appear at, and a filter applied per-caller is one that gets missed at
  the sixth. `catalogue()` is wrapped in React `cache` so one render costs one query.
- **`src/features/enquiries/`** — the only unauthenticated write path on the site. Zod-validated,
  throttled in Postgres (not per-process), and it returns an error rather than a false
  confirmation when a write fails.

## Roles

| Role        | Used by                   | May                                                                                                                |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `belso`     | migrations, seed, backups | everything — it is the image's superuser, and it is never used by the app                                          |
| `belso_app` | the web application       | `select` the catalogue, `insert` an enquiry, count the throttle. Nothing else — it cannot even read enquiries back |

The app being write-only over the personal data it collects is the strongest control available
short of not collecting it. See `docs/security/vps.md`, including the `RETURNING` consequence
that looks like a broken grant and is not.

## Schema and migrations

`db/migrations/NNNN_*.sql`, applied in order and exactly once by `pnpm db:migrate`. Each runs in
a transaction together with the row recording it, so a migration cannot half-apply and be marked
done. Applied files are checksummed: editing one that has already run is refused, because the
file and the database would then disagree silently.

Two modelling points worth knowing before touching the schema:

- **`publication` and `status` are different axes.** `status` is commercial (`available`,
  `underOffer`, `sold`, `rented`); `publication` is visibility (`draft`, `published`,
  `archived`). Conflating them makes a sold listing invisible and an archived one purchasable.
- **Slug history is written by a trigger**, not by the application. A back-office that renames a
  listing and forgets to record the old address is the failure being guarded against, and asking
  the app to remember is how it gets forgotten.

## Working against it

Port 5432 is bound to the VPS's loopback, so everything goes through a tunnel:

```bash
pnpm db:tunnel                  # ssh -N -L 55432:127.0.0.1:5432 belso-vps
pnpm db:migrate && pnpm db:seed
pnpm verify:db                  # migrate, seed, database tests, restore check
```

**`pnpm test:db` and `pnpm e2e` refuse any database not named `*_test`.** They unpublish live
listings and submit real enquiries; a scratch database (`belso_test`) exists for them. That guard
was added after an e2e run wrote a real enquiry into the client's table.

With no `DATABASE_URL` the repository serves the fixtures, which is what `pnpm verify`, the build
and a fresh clone do. **Production refuses to boot without one** — otherwise a mistyped variable
serves twenty invented villas as the agency's real inventory.
