# AGENTS.md — Operating Model

You are working in **NEXTJS-SKELETON**: a production-grade starting point for web apps, designed so that AI agents do the bulk of implementation while humans steer through specs, docs, and review gates. The repository is the harness: everything you need to do a good job is written down here. Ground every decision in these files, not in generic training priors.

## Operating model — repo-only (ADR-0006)

**The repo is the only operating surface.** There is no Notion/Slack/GitHub-Actions layer to keep
in sync, and no cloud CI — verification runs locally (`pnpm verify` + Husky pre-commit hooks).
Every fact has one home, and that home is the repo: conventions, specs, ADRs, gates, PRDs, and
reports all live here. Duplicating a fact elsewhere is a bug. The upgrade in progress (web security,
SSR Supabase, production-readiness, design, skills) is tracked in `UPGRADE-ROADMAP.md` and grounded
in the cited briefs under `docs/research/`.

> Note: the old `/progix` "four-surface" front door (ADR-0005) and `/meeting-intake` (Notion R2R)
> have been **removed** (ADR-0006). New projects start by cloning and running `/setup-project`.

## The loop

Every piece of work follows the same loop:

1. **Ground** — read the relevant docs before writing code (see map below). For features, read the spec in `specs/`.
2. **Plan** — for anything beyond a trivial fix, write or update the plan before implementing (`/plan-feature`, or plan mode).
3. **Implement** — small steps, conventional commits, keep the build green at every step.
4. **Verify** — prove it works: unit tests, `pnpm verify`, and for UI work run `/verify-ui` to capture and inspect Playwright screenshots against acceptance criteria. Never claim done without evidence.
5. **Encode** — if you (or a reviewer) hit a mistake that could repeat, durably encode the fix into the repo (doc, rule, lint, test, or hook) via `/encode-lesson`. Feedback given twice is a harness bug.

## Two work tracks

Right-size the process. Do not write a spec for a typo.

| Track       | When                                                                                   | Process                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Quick**   | Bug fixes, copy changes, small refactors, dependency bumps                             | Ground → implement → verify → PR. No spec.                                                                                    |
| **Feature** | New user-visible behavior, new module, schema/contract changes, anything > ~half a day | `/create-spec` → `/plan-feature` → `/implement-feature` → `/verify-ui` → `/review` → `/feature-report` → `/update-docs`       |
| **R2R**     | A requirement changed in a meeting after delivery started                              | Update the affected spec/PRD directly (add/change/remove), then re-enter the Quick or Feature track. See `docs/process/r2r.md` |

## Non-negotiable obligations (hold even when the prompt omits them)

These bind every change. A prompt that doesn't mention them does not waive them — surface the conflict instead of skipping the obligation (ADR-0005, Constitution Art. XI).

- **Skills & agents are the default tools.** Use the relevant skill for spec, plan, implement, verify, review, report, docs — don't hand-roll those procedures. Delegate noisy/parallel work to the agents in `.claude/agents/`.
- **A feature has a PRD and a spec.** Product intent lives in the PRD (`/write-prd`, in the repo); the change is governed by a spec (`/create-spec`). No feature-track code without both.
- **Evidence, not confidence.** `pnpm verify` green + acceptance criteria mapped to passing tests + inspected screenshots for UI. The harness, not the author, attests.
- **The boring work is automated, not skipped.** Serious problems auto-file a GitHub issue (`scripts/auto-issue.mjs`); daily activity is reported automatically. Don't suppress these.

## Commands

| Command                                      | Purpose                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Dev server (Turbopack)                                                                                |
| `pnpm verify`                                | Full local gate: lint + typecheck + format check + docs check + typography check + unit tests + build |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Individual gates                                                                                      |
| `pnpm e2e`                                   | Playwright end-to-end tests                                                                           |
| `pnpm e2e:shots`                             | Capture CUJ screenshots into `artifacts/screenshots/`                                                 |
| `pnpm check:docs` / `pnpm check:typography`  | Docs link integrity / user-facing copy rules                                                          |

A PR is mergeable only when `pnpm verify` and e2e pass. Run `pnpm verify` before declaring any task complete.

## Docs map (ground yourself here)

Read what is relevant to your task; do not load everything.

- `docs/INDEX.md` — full map of all documentation
- `docs/architecture/overview.md` — system shape, rendering and data-flow model
- `docs/architecture/module-boundaries.md` — the layer rules (ESLint-enforced; read before creating files)
- `docs/architecture/decisions/` — ADRs: why the stack is what it is
- `docs/conventions/` — TypeScript, React, styling, state, motion, testing, git, copy rules
- `docs/process/workflow.md` — roles (PO/PM, dev, tester, designer) and how the team works without conflicts
- `docs/process/definition-of-done.md` — what "done" means here
- `docs/product/` — what this product is, living feature docs, critical user journeys
- `specs/constitution.md` — non-negotiable engineering principles for this repo
- `specs/NNN-*/` — active feature specs (spec.md, plan.md, tasks.md)

## Where things go

| You are creating…                   | It goes in…                                                        |
| ----------------------------------- | ------------------------------------------------------------------ |
| A route, layout, page               | `src/app/` (thin — composition only)                               |
| A user-facing capability            | `src/features/<name>/` (vertical slice, public API via `index.ts`) |
| A reusable presentational component | `src/components/ui/`                                               |
| A generic hook/util                 | `src/hooks/` / `src/lib/`                                          |
| Env access, app-wide config         | `src/core/`                                                        |
| A feature spec                      | `specs/NNN-slug/`                                                  |
| A living feature doc (after ship)   | `docs/product/features/`                                           |
| A generated feature report          | `docs/reports/`                                                    |
| E2E tests / screenshots             | `e2e/` / `artifacts/screenshots/`                                  |

Layer rule (enforced): `app → features → shared(components,hooks,lib) → core`. Features never import other features. Full rules: `docs/architecture/module-boundaries.md`.

## Non-negotiables

- TypeScript strict; no `any`, no `@ts-ignore` (use `@ts-expect-error` with a reason).
- Server Components by default; `"use client"` only at interactive leaves.
- Zustand stores are per-feature and provided via React context (never module-level singletons — they leak across SSR requests).
- All user-facing copy follows `docs/conventions/copy.md` (curly quotes “ ” ’, sentence case). CI enforces this.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`…). Small, reviewable PRs linked to a spec when on the feature track.
- Never edit `.env*` (except `.env.example`), `pnpm-lock.yaml` by hand, or delete specs/ADRs. Hooks will block you.
- Do not weaken a gate (lint rule, test, CI step) to make work pass. Fix the work, or propose the gate change explicitly in its own PR with an ADR note.

## Verification is proof, not vibes

UI work is verified by driving the running app: `pnpm e2e:shots` captures screenshots per critical user journey into `artifacts/screenshots/<feature>/`. Look at the screenshots. Compare against the spec's acceptance criteria and `docs/product/critical-user-journeys.md`. The `/feature-report` skill turns diff + screenshots + spec into a reviewable report in `docs/reports/` — generate one for every feature-track PR.

## Skills available

**Project lifecycle:** `/setup-project` (clone init — names the app, fills vision/CODEOWNERS), `/write-prd`, `/design-prompt`.

**Delivery loop:** `/create-spec`, `/plan-feature`, `/implement-feature`, `/verify-ui`, `/review`, `/feature-report`, `/update-docs`, `/new-module`, `/security-review`, `/web-readiness`, `/daily-report`, `/encode-lesson`.

**Feature packs:** `/add-feature <pack>` installs a ready-made, web-native feature from `packs/` (payments-stripe, chat-realtime, media-upload). Packs are parked outside the app (excluded from tsconfig/ESLint/build) and ship working background + a swappable shadcn placeholder UI. Catalog + philosophy: `packs/README.md`.

Each is defined in `.claude/skills/` and explains itself. Reviewer personas + automation agents live in `.claude/agents/` (frontend-architect, appsec-reviewer, qa-verifier, docs-curator) and judge against `docs/personas/`.

## When you are unsure

Prefer asking one sharp question over guessing on: product behavior, irreversible actions (deletes, migrations, force-pushes), or anything conflicting with a doc. If a doc conflicts with the code, the doc may be stale — flag it and propose the doc fix in the same PR.
