# 0008 — Postgres on our own VPS, no Supabase

- **Status:** Accepted
- **Date:** 2026-08-28
- **Deciders:** Houssem Ferrani
- **Supersedes:** [0007](0007-supabase-backend.md)

## Context

ADR-0007 adopted Supabase for the **skeleton**, and its reasoning is sound for the case it
describes: an app whose browser talks to the database directly, holding a public anon key, where
Row-Level Security is the only thing standing between a visitor and everyone else's rows.

Belso is not that app.

Every read on this storefront goes through Server Components into
`src/features/properties/repository.ts`, which is `server-only`. The public reads published
listings; two or three people at the agency write them. There is no browser holding a database
key, no per-user row ownership, and no multi-tenant boundary — so RLS, the reason to pay
Supabase's complexity, would guard a door nobody walks through.

Meanwhile the client has decided to host on a VPS they control (Hostinger, Paris, 2 vCPU /
7.8 GB / 96 GB), already running Traefik with Let's Encrypt. The question is whether to run the
Supabase stack on it or plain Postgres.

The timing is what makes this cheap. Nothing Belso-shaped has been built on Supabase yet — the
three tables in `supabase/migrations/` are `profiles`, `notes` and `subscriptions`, inherited
demo schema from the skeleton. There is no properties table and no enquiries table. The
repository is still fixtures behind a documented seam, and that seam does not care what is
behind it.

## Decision

Run **Postgres directly on the VPS** and drop Supabase from Belso. Data access is typed SQL from
the server; the back-office is a small first-party session auth over a `users` table.

The `repository.ts` seam is where Postgres arrives, exactly as ADR-0007's Phase 2 intended for
Supabase — the pages above it do not change.

## Alternatives considered

| Option                                           | Why not                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep hosted Supabase** (ADR-0007 as written)   | We would use the database and ~5% of the platform. It also splits hosting across two vendors when the client's stated goal is to own one box.                                                                                                                                                           |
| **Self-host the full Supabase stack on the VPS** | ~8 containers (Kong, GoTrue, PostgREST, Realtime, Storage, Studio, meta) on 2 shared cores that also run n8n and Next.js. We would carry the operational weight of the whole platform to use Postgres and a login form. Upgrades of a self-hosted Supabase are notably more fragile than `postgres:17`. |
| **SQLite / LiteFS**                              | Tempting at this size, but the property model is relational (translations, districts, media) and Postgres is what the team and the ADR history already assume. No real saving.                                                                                                                          |
| **Keep fixtures, no database**                   | Fails the client's actual requirement: she must add listings herself through a back-office.                                                                                                                                                                                                             |

## Consequences

**Positive**

- One box, one bill, no vendor lock-in — the client owns the data and the machine.
- Less code and fewer moving parts: no `@supabase/ssr` cookie choreography, no anon/service-role
  key split, no RLS policies to get subtly wrong on a schema that has no row ownership anyway.
- Paris is close to optimal for this audience. Belso sells Marrakech property to a
  French and European buyer base; single-region hosting there is not a compromise.
- Deleting `src/lib/supabase/`, `src/features/auth/` and `supabase/` removes ~470 lines of
  scaffolding that no Belso feature imports.

**Negative / accepted trade-offs**

- **We now own backups.** Supabase did point-in-time recovery for us; on a VPS there is nothing
  unless we build it. Non-negotiable before the first real listing is entered, and it must be a
  _tested restore_, not just a dump job.
- **We now own patching, certs and uptime.** No platform fixes this box at 2am.
- **Single point of failure.** The site, the back-office, the database and the client's n8n share
  one machine. Accepted deliberately for a small agency’s brochure site; mitigated with
  snapshots plus a nightly local dump (spec 010) and a CDN in front. Note the backups live at
  the same provider as the machine — accepted knowingly, recorded in spec 010.
- **The `media-upload` pack becomes unusable as written** — it is built on Supabase Storage.
  Property images are the one place we genuinely wanted it, so that upload path must be rebuilt.
  `payments-stripe` and `chat-realtime` are also Supabase-bound but Belso needs neither.
- **Image optimisation lands on 2 shared cores.** Sharp transcoding large property photography is
  CPU-heavy and was free at the edge on Vercel. Must be designed for (pre-generated sizes and/or a
  caching CDN), not discovered in a Lighthouse run.
- This diverges from the upstream skeleton, which keeps ADR-0007. A future app cloned from the
  skeleton is unaffected; only Belso takes this path.

**Follow-ups required**

- Backup + verified restore before any real data. Blocking.
- Spec for the data layer and back-office (`specs/010-*`).
- Rewrite `docs/architecture/backend.md`, which documents the RLS-first model.
- Remove the Supabase env vars from `src/core/env.ts`, `env.client.ts` and `.env.example`; the
  deploy that failed on those vars is the last time they should matter.
- `docs/security/checklist.md` gains VPS items (firewall, ssh, backup encryption) that a managed
  platform previously answered.
