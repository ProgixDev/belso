# 0004 — The repository is the harness

- **Status:** Accepted
- **Date:** 2026-06-07
- **Deciders:** Engineering leadership

## Context

Code generation is no longer the constraint; context and verification are. Agents start every session blank. Teams that perform (OpenAI Frontier's "harness engineering": 1M LOC, ~250k lines of agent-governing markdown, zero hand-typed lines) put everything an agent needs _inside the repo_: legible docs, deterministic gates that prompt-inject corrections, review personas, and closed verification loops. Synchronous human steering does not scale; encoded feedback does.

## Decision

Treat the repo as the agent harness, with four mechanisms:

1. **Legibility** — `AGENTS.md` operating model (CLAUDE.md imports it, so any agent tool shares it); `docs/` tree as durable memory; path-scoped digests in `.claude/rules/`.
2. **Encoded taste** — conventions enforced by gates (boundaries lint, typography check, docs-link check); skills in `.claude/skills/` encode repeatable procedures; `/encode-lesson` turns any repeated correction into a doc/rule/test/hook. Feedback given twice is a harness bug.
3. **Closed verification loops** — agents prove work against the running app: Playwright CUJ runs, screenshots into `artifacts/screenshots/`, `/verify-ui` attestation, `/feature-report` evidence reports.
4. **Asynchronous review** — persona subagents (`.claude/agents/`) and `claude-code-action` in CI grade every PR against `docs/personas/` before a human looks.

## Alternatives considered

| Option                                            | Why not                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Prompt libraries outside the repo (Notion, wikis) | Not versioned with the code, invisible to agents, rots instantly.                                                     |
| Synchronous pairing with agents as policy         | Caps throughput at human attention; the goal is parallel, delegated work with confidence by default.                  |
| One mega-CLAUDE.md                                | Blows the context budget; adherence drops with length. Pointer-based docs + on-demand skills load only what's needed. |

## Consequences

- Positive: any team member — PM, designer, tester — can safely direct an agent; quality is enforced by the repo, not by who is watching.
- Negative: the harness needs gardening (stale docs are poison) — `/update-docs` and the docs-link gate exist for this; persona review in CI costs API tokens per PR (bounded, see workflow file).
- Follow-ups: track recurring agent failures in retros; each one must end as an encoded lesson.
