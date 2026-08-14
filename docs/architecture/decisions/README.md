# Architecture Decision Records

ADRs capture decisions that shape the codebase: what we chose, what we rejected, and why. They exist so that neither humans nor agents re-litigate (or silently reverse) settled decisions.

## Rules

- One decision per file: `NNNN-short-slug.md`, numbered sequentially. Use [TEMPLATE.md](TEMPLATE.md).
- Status is one of `Proposed`, `Accepted`, `Superseded by NNNN`.
- ADRs are immutable once accepted — supersede, don't edit history.
- Write one whenever you: add/replace a dependency with architectural weight, change module boundaries, change a CI gate, change the data-flow model, or make any choice a future reader would ask "why is it like this?" about.
- Agents: if your task requires deviating from an accepted ADR, stop and surface it. Propose a superseding ADR; do not quietly diverge.

## Index

| #                                         | Decision                                                                                                           | Status                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [0001](0001-baseline-stack.md)            | Baseline stack: Next.js App Router, TS strict, Tailwind v4 + shadcn/ui, Zustand, Motion, Vitest + Playwright, pnpm | Accepted                     |
| [0002](0002-module-boundaries.md)         | Layered module boundaries enforced by ESLint                                                                       | Accepted                     |
| [0003](0003-spec-driven-workflow.md)      | Right-sized spec-driven development workflow                                                                       | Accepted                     |
| [0004](0004-ai-harness.md)                | Repo-as-harness: agent docs, skills, hooks, persona review in CI                                                   | Accepted                     |
| [0005](0005-progix-operating-system.md)   | Progix operating system: /progix front door, four surfaces, R2R loop, default automations                          | Partially superseded by 0006 |
| [0006](0006-repo-only-operating-model.md) | Repo-only operating model (drop cloud CI/CD + Notion/Slack)                                                        | Accepted                     |
