# Feature Docs — living memory

One file per shipped feature. These are the **spec-anchored long-term memory**: specs in `specs/` describe a change while it's in flight; after ship, `/update-docs` distills the result here and the spec is archived. Agents ground on these when modifying existing behavior — keep them truthful or they poison every future change.

## Rules

- File name = feature slug (matches `src/features/<slug>/` when one exists): `task-list.md`.
- Update in the same PR that changes the behavior (Definition of Done item).
- When a feature is removed, don't delete the doc — add a final "Removed in #PR, because…" line and move it to `archive/` (cheap institutional memory).

## Template

```markdown
# <Feature name>

**Status:** live | experiment | removed · **Slice:** src/features/<slug> · **Routes:** /…
**Spec history:** specs/NNN-slug (shipped YYYY-MM-DD), …

## What it does (user terms)

Two or three sentences.

## How it works (one diagram or paragraph)

Key components, store, actions; anything non-obvious.

## Decisions & gotchas

- Dated bullets of things future changers must know.

## CUJs covered

- CUJ-NN (link)
```

## Index

| Feature          | Status | Doc                          |
| ---------------- | ------ | ---------------------------- |
| Task list (demo) | live   | [task-list.md](task-list.md) |
