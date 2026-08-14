# Plan 001 — Task list demo feature

- **Spec:** [spec.md](spec.md) (all open questions resolved: yes)
- **Author:** Engineering · **Date:** 2026-06-07

## Approach

Reference-quality vertical slice: SSR-safe Zustand store factory + provider, client island built from shadcn primitives, animated list via shared motion variants, painted-door server action. Optimized for being imitated.

## Placement

| What             | Where                             | Notes                                                   |
| ---------------- | --------------------------------- | ------------------------------------------------------- |
| Route            | `src/app/examples/tasks/page.tsx` | RSC seeds provider                                      |
| Slice            | `src/features/task-list/`         | store, components, actions, types                       |
| Shared additions | `src/components/motion.tsx`       | MotionProvider + shared variants (design-system intent) |

## Data & state

- Server data: static seed array in the page (no backend by design).
- Client state: `tasks: Task[]` in feature store; actions `addTask`, `toggleTask`, `clearDone`.
- Actions: `saveTasksAction` — zod-validated stub returning `{ ok: true }`.

## Acceptance criteria → verification mapping

| AC   | Proven by                                              |
| ---- | ------------------------------------------------------ |
| AC-1 | `store.test.ts` (add) + `e2e/task-list.spec.ts` step 2 |
| AC-2 | `store.test.ts` (toggle/remaining) + e2e step 3        |
| AC-3 | `store.test.ts` (rejects blank) + e2e step 4           |
| AC-4 | `store.test.ts` (clearDone) + e2e step 5               |

## Risks & unknowns

- None material; feature exists to de-risk everything else.

## Overlap check

Active specs touching the same areas: none.
