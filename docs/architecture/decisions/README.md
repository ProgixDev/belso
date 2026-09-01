# Architecture Decision Records

ADRs capture decisions that shape the codebase: what we chose, what we rejected, and why. They exist so that neither humans nor agents re-litigate (or silently reverse) settled decisions.

## Rules

- One decision per file: `NNNN-short-slug.md`, numbered sequentially. Use [TEMPLATE.md](TEMPLATE.md).
- Status is one of `Proposed`, `Accepted`, `Superseded by NNNN`.
- ADRs are immutable once accepted — supersede, don't edit history.
- Write one whenever you: add/replace a dependency with architectural weight, change module boundaries, change a CI gate, change the data-flow model, or make any choice a future reader would ask "why is it like this?" about.
- Agents: if your task requires deviating from an accepted ADR, stop and surface it. Propose a superseding ADR; do not quietly diverge.
- **0001–0007 came with the skeleton; 0008 onward are Belso's own.** Their `Deciders:` lines name the
  people who built the starting point this repository was cloned from, not stakeholders on this
  product — so "who decided this" is not a person to go and ask. Revisiting an inherited decision
  needs the same superseding ADR as any other and no additional permission:
  [0008](0008-postgres-on-our-own-vps.md) superseded [0007](0007-supabase-backend.md) exactly that
  way. The line is worth stating because reading a name there as a stakeholder is a natural mistake
  and has been made.

## Index

| #                                             | Decision                                                                                                           | Status                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [0001](0001-baseline-stack.md)                | Baseline stack: Next.js App Router, TS strict, Tailwind v4 + shadcn/ui, Zustand, Motion, Vitest + Playwright, pnpm | Accepted                     |
| [0002](0002-module-boundaries.md)             | Layered module boundaries enforced by ESLint                                                                       | Accepted                     |
| [0003](0003-spec-driven-workflow.md)          | Right-sized spec-driven development workflow                                                                       | Accepted                     |
| [0004](0004-ai-harness.md)                    | Repo-as-harness: agent docs, skills, hooks, persona review in CI                                                   | Accepted                     |
| [0005](0005-progix-operating-system.md)       | Progix operating system: /progix front door, four surfaces, R2R loop, default automations                          | Partially superseded by 0006 |
| [0006](0006-repo-only-operating-model.md)     | Repo-only operating model (drop cloud CI/CD + Notion/Slack)                                                        | Accepted                     |
| [0007](0007-supabase-backend.md)              | Supabase as the backend: RLS-first, `@supabase/ssr` cookie auth, deny-by-default                                   | Superseded by 0008           |
| [0008](0008-postgres-on-our-own-vps.md)       | Postgres on our own VPS, no Supabase                                                                               | Accepted                     |
| [0009](0009-maplibre-for-the-listings-map.md) | MapLibre GL JS + hosted vector tiles for the listings map                                                          | Accepted                     |
| [0010](0010-two-database-roles.md)            | Two Postgres roles: the storefront reads, the back-office writes                                                   | Accepted                     |
| [0011](0011-sessions-in-postgres.md)          | Sessions in Postgres, passwords with scrypt, no auth library                                                       | Accepted                     |
| [0012](0012-verify-on-push.md)                | Run `pnpm verify` on push, on a clean checkout (amends 0006 narrowly)                                              | **Proposed**                 |
