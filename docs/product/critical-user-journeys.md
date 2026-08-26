# Critical User Journeys (CUJs)

The journeys that must never break. Each CUJ has: an owner, an e2e spec in `e2e/`, and labeled screenshots captured by `pnpm e2e:shots`. CI runs all of them on every PR; `/verify-ui` re-runs the ones a change touches.

Adding or changing a CUJ is a product decision — PR must be approved by the product owner.

## Registry

| ID     | Journey                      | Steps (user's words)                                                                                                                                                                       | E2E spec                 | Screenshots |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ----------- |
| CUJ-01 | Land and reach the catalogue | Open `/` → land in the detected language → watch the splash intro resolve → scroll to the about sheet the scene ends on → read the three sections below it → follow one into the catalogue | `e2e/home.spec.ts`       | `0*-*`      |
| CUJ-02 | Manage tasks (demo feature)  | Open `/examples/tasks` → add a task → see it appear (animated) → toggle it done → remaining count updates                                                                                  | `e2e/task-list.spec.ts`  | `tasks-*`   |
| CUJ-03 | Browse to enquiry            | Open the site → describe what you want in the hero search → read the results with your words echoed back → open a listing → browse its gallery and price                                   | `e2e/properties.spec.ts` | `0*-*`      |
| CUJ-04 | Choose a neighbourhood       | Open the neighbourhood index → read what each address is for → open one → read it and see what is for sale there → follow a listing out of it                                              | `e2e/districts.spec.ts`  | `2*-*`      |
| CUJ-05 | Find a property on the map   | Open the catalogue → switch to the map → see the listings as points over Marrakech → open one → read its price and facets → follow it to its page                                          | `e2e/map.spec.ts`        | `3*-*`      |

## Rules

- A new feature with user-visible surface MUST either extend an existing CUJ or register a new one in this table (the `/create-spec` template asks).
- Each step in a journey asserts something the _user_ can see (text, role, state) — not implementation details.
- Screenshot names are stable (`<cuj>-<step>`), so reports and reviews can diff them release over release.
- When a CUJ changes intentionally, update the spec, this table, and the screenshots in the same PR — `/update-docs` walks you through it.
