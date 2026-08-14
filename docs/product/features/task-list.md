# Task list (demo feature)

**Status:** live · **Slice:** `src/features/task-list` · **Routes:** `/examples/tasks`
**Spec history:** specs/001-task-list (shipped 2026-06-07)

## What it does (user terms)

A minimal task manager: add tasks, toggle them done, see the remaining count. It exists to demonstrate every harness mechanism end-to-end — it is the reference implementation new features should imitate.

## How it works

- `store.ts` — Zustand store **factory** (vanilla, headlessly testable) with state `tasks[]` and actions `addTask`, `toggleTask`, `clearDone`; `provider.tsx` wraps it in the mandatory SSR-safe context provider + selector hook (`docs/conventions/state.md`).
- `components/task-list.tsx` — client island composed from `components/ui` primitives; list enter/exit animated with `m` + `AnimatePresence` per `docs/conventions/motion.md`.
- `actions.ts` — painted-door stub (`saveTasksAction`) that zod-validates and no-ops; replace with real persistence in a real project.
- Page `src/app/examples/tasks/page.tsx` is an RSC that seeds initial tasks into the provider.

## Decisions & gotchas

- 2026-06-07 — IDs come from `crypto.randomUUID()` in the store action, not in components, so tests can stub them in one place.
- 2026-06-07 — Store intentionally not persisted to localStorage; persistence is the first exercise a real project does on top of the skeleton.

## CUJs covered

- CUJ-02 — manage tasks (`e2e/task-list.spec.ts`)
