# TypeScript Conventions

Strictness is the cheapest reviewer we have. The compiler config is part of the harness — do not loosen it per-file.

## Rules

- `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Treat compiler errors as design feedback.
- **No `any`.** Use `unknown` + narrowing. No `@ts-ignore`; if truly unavoidable, `@ts-expect-error` with a one-line reason on the same line.
- **Validate at boundaries.** Anything crossing a trust boundary (env vars, request bodies, server action inputs, third-party responses) is parsed with **zod** and typed via `z.infer`. Inside the boundary, trust the types.
- **`type` over `interface`** except when declaration merging is required. One exported type per concept; don't re-declare shapes inline in props.
- **Discriminated unions over booleans** for state: `{ status: "idle" | "loading" | "error", … }`, never `isLoading + isError`.
- `readonly` for arrays/objects that shouldn't mutate; `as const` for literal tables.
- No enums — use union types or `as const` objects (enums generate runtime code and confuse tree-shaking).
- Narrow function signatures: accept the minimum (e.g. `Pick<Task, "id">`), return the most specific.

## Naming

- Files: `kebab-case.ts(x)`. Components: `PascalCase`. Hooks: `useThing`. Server actions: verb-first (`createTask`).
- Types: `PascalCase`, no `I` prefix, no `Type` suffix. Zod schemas: `taskSchema` → `type Task = z.infer<typeof taskSchema>`.
- Booleans read as predicates: `isOpen`, `hasAccess`, `canRetry`.

## Imports

- Use the `@/*` alias for anything outside the current folder; relative imports only within a slice.
- Import types with `import type { … }`.
- Cross-layer imports obey `docs/architecture/module-boundaries.md` (lint-enforced).

## Errors

- Never swallow: catch only where you can handle or annotate, otherwise let error boundaries / Next error pages do their job.
- Expected failures are values: return `{ ok: false, error }`-style results from actions; throw only for the unexpected.
