# Architecture Overview

## What this is

A single Next.js application (App Router, React Server Components) that serves as the canonical skeleton for the company's websites and web apps. It is optimized for two audiences at once: human engineers and AI coding agents. Everything that makes code "good" here is written down and, where possible, machine-enforced.

## Stack

| Concern           | Choice                             | Notes                                                         |
| ----------------- | ---------------------------------- | ------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack) | RSC-first; see ADR-0001                                       |
| Language          | TypeScript 5, strict               | `noUncheckedIndexedAccess` on                                 |
| Styling           | Tailwind CSS v4 + shadcn/ui        | CSS-first tokens in `globals.css`; see conventions/styling.md |
| Client state      | Zustand 5                          | Per-feature stores via context; see conventions/state.md      |
| Animation         | Motion (`motion/react`)            | LazyMotion + reduced-motion safe                              |
| Unit tests        | Vitest + Testing Library           | Colocated `*.test.ts(x)`                                      |
| E2E + screenshots | Playwright                         | CUJ specs in `e2e/`, screenshots in `artifacts/screenshots/`  |
| Package manager   | pnpm (pinned via `packageManager`) | Node version in `.nvmrc`                                      |

## Rendering & data flow

1. **Server Components are the default.** Pages and layouts in `src/app/` fetch data on the server and pass it down. No client-side data fetching for first render.
2. **Client islands.** Interactivity lives in leaf components marked `"use client"`, almost always inside a feature slice.
3. **Mutations** go through Server Actions colocated in the owning feature (`src/features/<name>/actions.ts`), validated with zod at the boundary.
4. **Client state** (UI state, optimistic state) lives in the feature's Zustand store, created per-request via a provider — never module-level.
5. **URL is state** where possible: filters, tabs, pagination belong in searchParams before they belong in a store.

```
request → app/ (RSC: layout, page — fetch, compose)
            └─ features/<x>/ (client islands + actions + store)
                 └─ components/ui/ (dumb, reusable)
                      └─ core/ (env, config — no React)
```

## Source layout

```
src/
  app/         routes, layouts, route handlers — composition only, no business logic
  features/    vertical slices (ui + store + actions + types), public API via index.ts
  components/  shared presentational components (ui/ = design system)
  hooks/       shared generic hooks
  lib/         shared pure utilities
  core/        env validation, app config, constants — imports nothing internal
e2e/           Playwright CUJ tests
specs/         feature specs (SDD) + constitution
docs/          this tree
scripts/       repo automation (checks, hooks, report generation)
artifacts/     generated, gitignored (screenshots, traces)
```

Import rules between these layers are enforced by ESLint — see [module-boundaries.md](module-boundaries.md).

## Quality gates (defense in depth)

| Gate                          | Where                     | Catches                                             |
| ----------------------------- | ------------------------- | --------------------------------------------------- |
| TypeScript strict             | editor + CI               | type errors                                         |
| ESLint (+ boundaries)         | editor + pre-commit + CI  | style, layer violations                             |
| Prettier                      | on-edit hook + pre-commit | formatting                                          |
| Vitest                        | CI                        | logic regressions                                   |
| Playwright + screenshots      | CI + `/verify-ui`         | broken CUJs, visual regressions                     |
| check:docs / check:typography | CI                        | dead doc links, copy violations                     |
| Persona review (AI)           | PR via claude-code-action | architecture/security/QA issues before human review |
| Human review                  | PR                        | intent, taste, product fit                          |

The order matters: cheap deterministic gates run first so expensive reviewers (AI and human) only see plausible work.
