# Plan NNN — <Feature name>

- **Spec:** [spec.md](spec.md) (all open questions resolved: yes/no)
- **Author:** <dev/agent> · **Date:** YYYY-MM-DD

## Approach

One paragraph: the shape of the solution and the key trade-off taken. If an ADR is needed (new dep, boundary change), link it here — write it before implementing.

## Placement (per `docs/architecture/module-boundaries.md`)

| What             | Where                   | Notes                                               |
| ---------------- | ----------------------- | --------------------------------------------------- |
| Route(s)         | `src/app/...`           | thin page, RSC                                      |
| Slice            | `src/features/<slug>/`  | store? actions?                                     |
| Shared additions | `src/components/ui/...` | only with a second consumer or design-system intent |

## Data & state

- Server data: …(fetch where, cache how)
- Client state: …(store shape, or "none — URL/local state")
- Actions: …(inputs zod-validated, authz check)

## Acceptance criteria → verification mapping

| AC   | Proven by                                                |
| ---- | -------------------------------------------------------- |
| AC-1 | unit: `store.test.ts` / e2e: `e2e/<slug>.spec.ts` step … |
| AC-2 | …                                                        |

## Risks & unknowns

- …(and how the plan de-risks them — spike task, painted door, flag)

## Overlap check

Active specs touching the same areas: none / spec NNN → resolution (sequence, coordinate, split).
