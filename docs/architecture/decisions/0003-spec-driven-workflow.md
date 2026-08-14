# 0003 — Right-sized spec-driven development

- **Status:** Accepted
- **Date:** 2026-06-07
- **Deciders:** Engineering + Product leadership

## Context

Spec-driven development (SDD) makes specs the shared source of truth between PM, design, engineering, and AI agents: agents implement from written intent instead of synchronous steering. But field evaluations (Böckeler/Thoughtworks on Kiro, spec-kit, Tessl, Oct 2025) document real failure modes: one heavy workflow applied to every problem size ("sledgehammer for a nut"), verbose generated markdown that's worse to review than code, and a false sense of control when agents ignore parts of large specs.

## Decision

Adopt SDD with two deliberate constraints:

1. **Two tracks.** Quick track (no spec) for small changes; feature track (spec → plan → tasks → implement) only for new user-visible behavior or structural change. Defined in `AGENTS.md` and `docs/process/workflow.md`.
2. **Spec-anchored, then archived into living docs.** A spec in `specs/NNN-slug/` is the source of truth for the _lifetime of the change_. After ship, `/update-docs` distills it into the permanent feature doc (`docs/product/features/`) and the spec folder is marked shipped. Long-term truth lives in docs, not in a pile of stale specs.

Templates (`specs/TEMPLATE/`) are deliberately lean — one page each — to keep review load low. The constitution (`specs/constitution.md`) plays the spec-kit "constitution" role: principles enforced on every change regardless of track.

## Alternatives considered

| Option                                   | Why not                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adopt spec-kit's CLI + full template set | Heavier artifact set than we can review honestly; we keep its phase model (constitution/specify/plan/tasks/implement) but with leaner artifacts native to our harness. |
| No SDD (pure vibe + review)              | Loses the PM/designer-to-agent contract and the audit trail; review burden lands entirely on humans late.                                                              |
| Spec-as-source (Tessl-style)             | Immature; non-determinism + 1:1 spec-to-file coupling doesn't fit app development today.                                                                               |

## Consequences

- Positive: PMs ship via written intent; agents get unambiguous acceptance criteria; reports/verification trace back to the spec.
- Negative: discipline needed to keep specs lean and to archive them — `/update-docs` exists to make that cheap.
- Follow-ups: revisit track thresholds quarterly using `docs/reports/` outcomes.
