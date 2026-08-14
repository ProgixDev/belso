# 0002 — Enforce layered module boundaries with ESLint

- **Status:** Accepted
- **Date:** 2026-06-07
- **Deciders:** Engineering leadership

## Context

Hyper-growth codebases fail by business logic spreading everywhere ("bowl of mud"): every change has non-local effects, parallel work conflicts, and agents can't load a bounded context. Convention alone does not survive deadline pressure or autonomous agents.

## Decision

Adopt the layer model `app → features → shared → core` with vertical feature slices and public APIs via `index.ts`, statically enforced by `eslint-plugin-boundaries` (`element-types` + `entry-point` rules). Violations fail lint locally, in the pre-commit hook, and in CI.

## Alternatives considered

| Option                         | Why not                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Convention only (docs, review) | Doesn't bind agents or hurried humans; erosion is one approved PR away.           |
| Physical packages (monorepo)   | Stronger walls but heavier tooling; see ADR-0001.                                 |
| dependency-cruiser             | Fine tool, but a second config/runtime next to ESLint; boundaries keeps one gate. |

## Consequences

- Positive: conflict-free parallel work, safe feature deletion, bounded agent context, painted-door experiments are safe by construction.
- Negative: occasional friction when code wants to be shared — resolved by deliberate promotion to `shared`, which is the point.
- Follow-ups: boundary config changes require a superseding ADR.
