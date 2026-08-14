---
paths:
  - "src/features/**"
---

# Working in src/features (digest — full rules: docs/architecture/module-boundaries.md, docs/conventions/state.md)

- A slice may import `@/components`, `@/hooks`, `@/lib`, `@/core` — **never another feature, never `app`**. Lint enforces this; design within it.
- Everything other layers may use is exported from the slice's `index.ts` — keep that surface minimal.
- Stores are factories + context providers (SSR safety), actions live inside the store, components subscribe via selectors.
- `actions.ts`: `"use server"`, zod-parse every input, authorize before mutating, return result objects for expected failures.
- Mirror the canonical slice `src/features/task-list/` for file anatomy; colocate `*.test.ts(x)`.
- New slice? Use `/new-module <name>` instead of hand-rolling.
