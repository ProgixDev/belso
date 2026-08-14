# Module Boundaries

The single most important structural rule in this repo. Boundaries are what let many people (and many agents) work in parallel without conflicts, and what prevents the codebase from collapsing into a bowl of mud. They are **statically enforced** by `eslint-plugin-boundaries` — violations fail lint, locally and in CI.

## The layers

```
app  →  features  →  shared (components, hooks, lib)  →  core
```

An arrow means "may import from". Anything not allowed is forbidden.

| Layer      | Path                                              | May import             | Must never                                         |
| ---------- | ------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| `app`      | `src/app/**`                                      | features, shared, core | contain business logic; it composes                |
| `features` | `src/features/<name>/**`                          | shared, core           | import **other features** or `app`                 |
| `shared`   | `src/components/**`, `src/hooks/**`, `src/lib/**` | core, other shared     | import features or app; know about domain concepts |
| `core`     | `src/core/**`                                     | (nothing internal)     | import React or anything above it                  |

## Feature slices

A feature is a vertical slice owning everything for one capability:

```
src/features/task-list/
  index.ts        ← public API. The ONLY file other layers may import.
  components/     ← feature UI (client islands live here)
  store.ts        ← zustand store factory (vanilla, headlessly testable)
  provider.tsx    ← context provider + useXStore(selector) hook
  actions.ts      ← server actions (zod-validated)
  types.ts
  lib.ts          ← feature-private helpers
  *.test.ts(x)    ← colocated unit tests
```

Rules:

- **Public API via `index.ts`.** `app` imports `@/features/task-list`, never `@/features/task-list/components/...` (ESLint `boundaries/entry-point` enforces this).
- **Features don't know each other.** If two features must share something, the shared thing moves down to `shared` or `core`, or the features compose in `app`. This is what keeps parallel work conflict-free: two teams in two features can never collide.
- **Promote late.** Code starts in the feature. Move it to `shared` only on the second real consumer. Premature promotion creates coupling.

## Why so strict

- **Parallelism without conflicts.** PRs touch one slice; merge conflicts and coordination drop dramatically. This is the team-scaling mechanism, not an aesthetic preference.
- **Agent legibility.** An agent grounding itself can read one slice and have everything; context stays small and accurate.
- **Safe deletion.** A feature can be deleted by removing one folder and its route. If that's not true, boundaries were violated.
- **Painted-door experiments.** Designers/PMs can build UI inside a slice against a stubbed action with zero risk to other code (see `docs/process/painted-door.md`).

## Creating a new feature

Use `/new-module <name>` — it scaffolds the structure above, wires the provider, and adds test stubs. Don't hand-roll the layout.

## Changing the rules

The boundary config lives in `eslint.config.mjs`. Changing it is an architectural decision: separate PR + ADR in `docs/architecture/decisions/`. Never relax a rule inline to make a task pass (see `specs/constitution.md`).
