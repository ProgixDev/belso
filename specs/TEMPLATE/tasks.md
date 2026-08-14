# Tasks NNN — <Feature name>

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and never reorders silently. `[P]` marks tasks safe to parallelize. Every task names its files and its done-check. Keep tasks ≤ ~30 min of work each.

## Phase 0 — setup

- [ ] T0 Create branch `feat/NNN-slug`; scaffold slice with `/new-module <slug>` (files: `src/features/<slug>/*`)

## Phase 1 — core behavior (AC-1, AC-2)

- [ ] T1 Store: implement `<X>State` + actions in `store.ts` · done: `store.test.ts` green (AC-1 unit)
- [ ] T2 [P] UI: `components/<x>.tsx` from `components/ui` primitives, all states (empty/loading/error) · done: renders in route
- [ ] T3 Action: `actions.ts` zod-validated `<verb>Action` · done: invalid input returns typed error (AC-3 unit)
- [ ] T4 Route: `src/app/.../page.tsx` RSC seeds provider · done: page serves

## Phase 2 — verification

- [ ] T5 E2E: `e2e/<slug>.spec.ts` covering CUJ steps with `shot()` captures · done: `FEATURE=NNN-slug pnpm e2e:shots` green
- [ ] T6 Run `/verify-ui` — inspect screenshots against ACs; fix what you see
- [ ] T7 `pnpm verify` green; commit history clean (conventional)

## Phase 3 — review & ship

- [ ] T8 Run `/review`; fix P0/P1 findings
- [ ] T9 Run `/feature-report` → `docs/reports/NNN-slug.md`
- [ ] T10 Open PR (template filled, spec + report linked)
- [ ] T11 After merge: `/update-docs` (feature doc, CUJ table, specs index status)

## AC coverage (mirror of plan.md — keep ticked in sync)

- [ ] AC-1 → T1, T5 · [ ] AC-2 → T2, T5 · [ ] AC-3 → T3
