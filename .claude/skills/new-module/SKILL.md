---
name: new-module
description: Scaffold a new feature slice in src/features/<name> with the canonical structure — store factory + provider, components, zod-validated action stub, types, index.ts public API, and test stubs. Use whenever work needs a new feature module, the user says "new feature/module/slice", or /plan-feature's task T0 calls for it. Never hand-roll slice layouts.
argument-hint: [slice-name-kebab-case]
allowed-tools: Read Write Glob Bash(pnpm lint*) Bash(pnpm typecheck*) Bash(pnpm test*)
---

## Task

Scaffold `src/features/$ARGUMENTS/` by **mirroring the canonical slice** `src/features/task-list/` — read it first; it is the template. Same file anatomy, same patterns, renamed and emptied of task-specific logic:

```
src/features/$ARGUMENTS/
  index.ts        ← exports ONLY what app/ needs (provider + main component, typically)
  types.ts        ← zod schema + inferred types for the slice's core entity
  store.ts        ← create<Name>Store vanilla factory (headlessly testable)
  provider.tsx    ← <Name>StoreProvider + use<Name>Store(selector) context hook
  actions.ts      ← "use server"; one zod-validated stub action returning { ok: true }
  components/<name>.tsx  ← client island shell built from @/components/ui, with a designed empty state
  store.test.ts   ← store created via factory; one real assertion per action stub
```

Rules that make this scaffold correct (not just present):

- The store is a **factory + context provider** — never a module-level store (SSR request leak; see `docs/conventions/state.md`).
- `index.ts` is the entire public surface; deep imports from outside the slice fail lint (`boundaries/entry-point`).
- The action stub validates input even as a stub — painted-door experiments depend on stubs that _cannot_ mutate (see `docs/process/painted-door.md`).
- Copy in the shell component follows `docs/conventions/copy.md` (curly quotes — the typography gate scans it).
- No route is created here; routes are composition and belong to the feature's tasks (`src/app/...`).

Finish: run `pnpm lint && pnpm typecheck && pnpm test` (all must pass with the stubs), then list the created files and the next task from the spec's tasks.md.
