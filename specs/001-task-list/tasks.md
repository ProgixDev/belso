# Tasks 001 — Task list demo feature

All complete — kept as the canonical example of a finished task file.

## Phase 0 — setup

- [x] T0 Scaffold slice `src/features/task-list/*`

## Phase 1 — core behavior

- [x] T1 Store factory + provider in `store.ts` · `store.test.ts` green (AC-1..4 unit)
- [x] T2 UI `components/task-list.tsx` from ui primitives, empty state included
- [x] T3 `actions.ts` zod-validated painted-door stub
- [x] T4 Route `src/app/examples/tasks/page.tsx` seeds provider

## Phase 2 — verification

- [x] T5 `e2e/task-list.spec.ts` with `shot()` captures (CUJ-02)
- [x] T6 `/verify-ui` — screenshots inspected against ACs
- [x] T7 `pnpm verify` green

## Phase 3 — review & ship

- [x] T8 `/review` — no P0/P1
- [x] T9 Report → `docs/reports/` (skeleton baseline)
- [x] T10 Landed with skeleton
- [x] T11 `/update-docs` — `docs/product/features/task-list.md`, CUJ-02 registered

## AC coverage

- [x] AC-1 → T1, T5 · [x] AC-2 → T1, T5 · [x] AC-3 → T1, T5 · [x] AC-4 → T1, T5
