# Back-office

**Status:** live · **Slice:** `src/features/admin` (+ the write half of `src/features/properties`) · **Routes:** `/admin/*`, `/media/*`
**Spec history:** [specs/011-belso-back-office](../../../specs/011-belso-back-office/spec.md) (shipped 2026-09-01) · [report](../../reports/011-belso-back-office.md)

## What it does (user terms)

The agency signs in at `/admin/connexion` and runs its own catalogue: write a listing, leave it
half-finished for a week, publish it, translate it later, rename it, upload and order its
photographs, take it off the site when it sells. Nothing needs a developer.

A listing publishes with **French alone**. English is offered on the same form and never required —
the English site shows the French text with the untranslated note until somebody writes it.

Reading enquiries is not here. That is [spec 012](../../../specs/012-belso-inbox/spec.md), blocked
on choosing a mail provider.

## How it works

```
/admin/*  →  proxy.ts        cookie present?      → bounce to sign-in (GET only)
          →  (dashboard)/layout.tsx               → requireSession() — the gate for pages
          →  server action                        → requireSession() — the gate for actions
                ↓
          properties/writes.ts  editorTransaction  → belso_editor
          properties/media.ts   sharp              → MEDIA_ROOT on disk
```

**Three gates, not one, because they guard different things.** `proxy.ts` runs on Edge and can only
check that a cookie _exists_ — anyone can set one and get past it. It buys the ordinary signed-out
visit landing on the sign-in form. The layout is the authority for pages. Every action calls
`requireSession()` on its own first line, because **a Server Action is an addressable POST endpoint
reachable without the page it lives on ever rendering**. AC-1 states both halves separately for
this reason.

Sessions are a Postgres table ([ADR-0011](../../architecture/decisions/0011-sessions-in-postgres.md)):
the cookie carries a random token, the database stores only its SHA-256. Passwords are scrypt with
their parameters stored alongside each hash. Accounts exist only via `pnpm admin:user` over SSH —
there is no sign-up route and there will not be one.

Writes go through a **second database role**, `belso_editor`
([ADR-0010](../../architecture/decisions/0010-two-database-roles.md)). The storefront's role cannot
write a listing; the editor's role cannot delete one. `DATABASE_EDITOR_URL` never falls back to
`DATABASE_URL`.

## Decisions & gotchas

- **2026-09-01 — `/admin` has its own root layout.** A third one, so `<html lang>` is French. A
  nested layout cannot change it, and the back-office announcing French prose as English is a
  screen-reader defect. It also carries `export const dynamic = "force-dynamic"`: without it Next
  prerenders `/admin/listings`, hits an unset `DATABASE_EDITOR_URL` and fails the whole build — on
  a clean clone, while local `pnpm verify` stays green because `.env.local` exists.
- **2026-09-01 — publishing is stricter than saving, deliberately.** The save schema is loose so a
  morning's half-finished work is never lost; the publish schema names the missing French fields.
  Do not merge them.
- **2026-09-01 — slug history is written by a trigger, not the application.** A back-office that
  renames a listing and forgets to record the old address is the failure being guarded against, and
  asking the app to remember is how it gets forgotten (AC-5).
- **2026-09-01 — `publication` and `status` are different axes.** `publication` is visibility
  (draft/published/archived); `status` is commercial (available/under offer/sold/rented).
  Conflating them makes a sold listing invisible and an archived one purchasable.
- **2026-09-01 — photographs upload one per submission.** A gallery is fifteen requests of about
  half a second, not one seven-second wait. Batching them into a single submission would put
  fifteen sequential decode-and-encode cycles behind one request on a two-core box that also runs
  Postgres. Measured: `pnpm measure:upload`.
- **2026-09-01 — the original photograph is kept and never served.** It carries EXIF, and a camera
  writes the location it was standing in — for a private residence, the address. The media route
  allow-lists `<uuid>/master.webp` and serves nothing else.
- **2026-09-01 — nothing asks for photograph descriptions.** `publishableSchema` says nothing about
  alt text, so fifteen undescribed photographs publish without comment. The gallery falls back to
  "Photo 3 sur 15" so no control is ever unnamed, but the prompt in the editor is still owed. See
  the report's follow-ups.
- **2026-09-01 — a password change destroys that account's sessions**, as a disable does. It did
  not, for a while, which is backwards for the command you reach for when you think somebody else
  has the account (`scripts/admin-user.mjs`, SEC-AUTH-002).
- **2026-09-01 — `THROTTLE_SECRET` is required in production** and `env.ts` refuses to boot without
  it, on every route rather than only `/admin`. Unset, the throttle keys are a bare hash of an
  email address.
- **2026-09-01 — the e2e admin specs skip themselves** without `BELSO_E2E_ADMIN_EMAIL` and
  `BELSO_E2E_ADMIN_PASSWORD`. A green summary with ten skips is not a green summary; read the skip
  count.
- **Deploy-time, still open:** `belso_editor` exists on production with no password.
  `scripts/vps/belso-roles.sh` provisions one.

## CUJs covered

- [CUJ-06 — Publish a listing](../critical-user-journeys.md) · `e2e/listing-editor.spec.ts`,
  `e2e/admin-auth.spec.ts` · screenshots `5*-*` and `6*-*`
