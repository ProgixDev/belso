# Spec 001 — Task list demo feature

- **Status:** shipped (2026-06-07)
- **Type:** feature
- **Requested by / owner:** Engineering (skeleton reference feature)
- **Date:** 2026-06-07
- **Slice / areas touched:** `src/features/task-list`, route `/examples/tasks`

## Problem (the why)

The skeleton needs one real feature proving every harness mechanism end-to-end — boundaries, SSR-safe state, motion, e2e + screenshots, report — so teams imitate a working example instead of interpreting docs from scratch.

## Desired behavior (the what)

A user opens the tasks example page, sees seeded tasks, types a title and adds a task (it animates in), toggles tasks done, and always sees how many remain. Done tasks can be cleared.

## Acceptance criteria

- **AC-1:** Given the page is open, when the user submits a non-empty title, then the task appears in the list and the input clears.
- **AC-2:** When the user toggles a task, its done state flips and the "remaining" count updates immediately.
- **AC-3:** Submitting an empty/whitespace title does nothing and the input shows it is required (no crash, no empty task).
- **AC-4:** "Clear done" removes only completed tasks; with none completed it is disabled.

## Out of scope

- Persistence (action is a painted-door stub), auth, multi-list, drag-and-drop.

## CUJ impact

- Registers CUJ-02 — manage tasks (`e2e/task-list.spec.ts`).

## Open questions

(none — resolved at design time)
