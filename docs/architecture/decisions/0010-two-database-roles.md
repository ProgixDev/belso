# 0010 — Two Postgres roles: the storefront reads, the back-office writes

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Houssem Ferrani
- **Context:** [spec 011](../../../specs/011-belso-back-office/spec.md), extends [0008](0008-postgres-on-our-own-vps.md)

## Context

Migration `0004` gave the application a least-privilege role. `belso_app` can read published
listings, insert an enquiry, and count the throttle — and nothing else. It cannot read enquiries
back, cannot write a listing, and cannot create a database. That was deliberate: the storefront is
the one part of this system a stranger can reach, so it holds the smallest credential that still
does its job.

Spec 011 gives the client an editor. The editor writes listings, and it runs in the same Next
process as the storefront. So the question is whether `belso_app` grows write privileges, or
whether a second role arrives.

## Decision

A second role, **`belso_editor`**, with `insert`/`update` on the catalogue tables and its own
connection string. `belso_app` is unchanged.

`src/core/db.ts` gains `editorQuery()` and `editorTransaction()` on a second pool. `query()` — the
one the storefront uses — keeps the role that cannot write a listing.

**Two exported names, not a privilege argument.** An argument has a default, and a default that
silently escalates is the wrong direction. Two names also make the audit a single command: if
`grep editorQuery src/features/properties/repository.ts` returns nothing, the public read path
provably cannot write.

## Alternatives considered

| Option                                                                | Why not                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Widen `belso_app`** with catalogue writes and `select` on enquiries | Undoes exactly the property 0004 exists to hold. `loadBySlug` is the one place an anonymous visitor's string reaches SQL; today a defect there yields twenty listings already published on the website. Widened, the same defect yields every enquiry — names, emails, phone numbers — plus write access to the catalogue. |
| **One role, and rely on parameterised queries**                       | They are the first line and they are good. But `query(text, values)` being the only door is a control we chose to _enforce structurally_ rather than trust; the grant model is the same argument one layer down. Defence that survives a single mistake is the point.                                                      |
| **A separate process for the back-office**                            | Genuinely stronger — it would make the separation an OS boundary rather than a variable. It also means a second deployment, a second build, and shared session state, for a back-office with three users on a two-core box. Revisit if the admin surface grows.                                                            |

## Consequences

**Positive**

- A defect in the public read path cannot reach the enquiry table or write a listing.
- The grant list is the specification of what each half of the app may do, checkable in `psql`
  rather than inferred from code.

**Negative / accepted trade-offs**

- **This is not process isolation, and the ADR should not be read as claiming it.** Both roles live
  in the same Node process; an attacker with arbitrary code execution reads both connection
  strings out of the environment. What it defends against is a _SQL-level_ defect — injection, a
  wrong `where`, a missing filter — not a compromised runtime.
- **A second secret, and a second thing a deploy can forget.** `DATABASE_EDITOR_URL` must not fall
  back to `DATABASE_URL`: the fallback would defeat the split while looking like a convenience.
  Unset in production, `/admin` reports itself unconfigured; the storefront is unaffected and
  keeps serving.
- Every future table needs its grants written twice, once per role. `0004` already records that a
  new table is invisible until granted, which is the safe direction and the reason this is a
  chore rather than a hazard.

**Follow-ups**

- `scripts/vps/belso-app-role.sh`, referenced by migration 0004, does not exist — a dangling
  reference from spec 010. The script that provisions both roles' passwords lands with this work.
- `belso_editor` needs `select, insert, update` on `property_slug_history`: `record_retired_slug()`
  is plain `plpgsql` with no `SECURITY DEFINER`, so the trigger runs as the invoker. Miss it and
  renaming a listing fails with a permission error raised from inside a trigger, which reads like
  a broken migration and is not.
