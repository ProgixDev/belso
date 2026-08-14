# Critical User Journeys (CUJs)

The journeys that must never break. Each CUJ has: an owner, an e2e spec in `e2e/`, and labeled screenshots captured by `pnpm e2e:shots`. CI runs all of them on every PR; `/verify-ui` re-runs the ones a change touches.

Adding or changing a CUJ is a product decision — PR must be approved by the product owner.

## Registry

| ID     | Journey                     | Steps (user's words)                                                                                      | E2E spec                | Screenshots |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------- | ----------- |
| CUJ-01 | Land and orient             | Open `/` → understand what this is → reach the example or docs in one click                               | `e2e/home.spec.ts`      | `home-*`    |
| CUJ-02 | Manage tasks (demo feature) | Open `/examples/tasks` → add a task → see it appear (animated) → toggle it done → remaining count updates | `e2e/task-list.spec.ts` | `tasks-*`   |

## Rules

- A new feature with user-visible surface MUST either extend an existing CUJ or register a new one in this table (the `/create-spec` template asks).
- Each step in a journey asserts something the _user_ can see (text, role, state) — not implementation details.
- Screenshot names are stable (`<cuj>-<step>`), so reports and reviews can diff them release over release.
- When a CUJ changes intentionally, update the spec, this table, and the screenshots in the same PR — `/update-docs` walks you through it.
