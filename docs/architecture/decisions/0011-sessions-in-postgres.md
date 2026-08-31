# 0011 — Sessions in Postgres, passwords with scrypt, no auth library

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Houssem Ferrani
- **Context:** [spec 011](../../../specs/011-belso-back-office/spec.md), follows [0008](0008-postgres-on-our-own-vps.md)

## Context

Supabase auth was deleted one commit before this decision ([0008](0008-postgres-on-our-own-vps.md),
`f67ef86`), so the repository has no session layer at all. The back-office needs one for three
people at a Marrakech agency.

The obvious move is to add an auth library. This records why we did not, because "why not
next-auth" is the first question anyone will ask and it deserves an answer better than taste.

## Decision

**Sessions are a table.** An opaque 256-bit random token in an `httpOnly` cookie; the row is keyed
by its SHA-256, so a database dump is not a set of live cookies. **Passwords are `scrypt` from
`node:crypto`**, stored with their parameters. **No sign-up route** — accounts and password
resets are `scripts/admin-user.mjs`, run over SSH as the owner, the same posture as `migrate.mjs`.

Session verification lives in **`src/core/session.ts`**, not in the admin slice. Both
`features/properties` (the publish action) and, later, `features/enquiries` (mark-handled) must
authorise themselves, and features may not import features. The precedent is written into
`core/i18n.ts`: it lives in `core` because `proxy.ts` needs it and the boundary rules forbid
importing a feature from there. Same argument, one layer up.

## Alternatives considered

| Option                                | Why not                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NextAuth / Auth.js**                | Wants to own the session cookie, the route gate and the schema — three architectural decisions arriving as one `pnpm add`, in a repo whose ADR-0001 explicitly values dependency count. It also solves problems we do not have: OAuth providers, account linking, adapters for databases we are not using. |
| **JWT in a cookie, no session table** | Stateless is a feature when you have many servers. We have one, and the property we actually want is _revocation_ — disabling a person must take effect on their next request, which a self-contained token cannot do without a denylist, which is a session table with worse ergonomics.                  |
| **`@node-rs/argon2`**                 | Argon2id is the better algorithm and this is the closest call here. It is a native dependency with per-platform artefacts, for three accounts, where scrypt with tuned parameters is memory-hard and already in the Node runtime. Revisit if there is ever a public sign-up.                               |
| **A shared password for the agency**  | No way to revoke one person, and no answer to "who published that". Rejected in the spec, recorded here because it is what a small team drifts toward.                                                                                                                                                     |

## Consequences

**Positive**

- Revoking somebody is one `UPDATE`. Ending every session is one `DELETE`.
- No dependency, no adapter, no migration from a library's schema when it changes.
- The session lookup is a primary-key hit against a database the request is already talking to.

**Negative / accepted trade-offs**

- **We own the details, and the details are where auth goes wrong.** Timing-safe comparison, a
  dummy verify for unknown emails so the response time does not answer the question the message
  refuses to, `sameSite` and `path` on the cookie, throttling both by network and by account.
  Each is written down in the plan and tested, because none of them is obvious enough to survive
  being assumed.
- **Password reset is manual.** Three users and no mail provider makes that correct today and
  wrong later; when 012 brings a provider, reset is a small follow-up rather than a rewrite.
- **The proxy cannot be the authority.** It runs on Edge, where `pg` cannot open a socket, so it
  checks cookie _presence_ for a fast redirect and nothing more. The authority is the admin layout
  and, separately, every action — because a Server Action is an independently addressable
  endpoint and "the layout checked" is not a check for something the layout never rendered.
