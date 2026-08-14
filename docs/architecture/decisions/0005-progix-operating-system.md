# 0005 — The Progix operating system: one front door, four surfaces, R2R

- **Status:** Partially superseded by [ADR-0006](0006-repo-only-operating-model.md) — the **four-surface (Notion / GitHub / Slack / repo) model and cloud CI/CD are dropped**; the repo is the only operating surface. The spec track, sizing gate, and skills introduced here remain.
- **Date:** 2026-06-08
- **Deciders:** Achraf Arabi (lead), Ilyes Ghorieb (Progix), Mohamed Bouhezza (PM)

## Context

The skeleton makes a single repository legible and safe for agents. But a Progix project is more than a repo: it has a client, a PM, meetings whose requirements change weekly, a Notion workspace the non-engineers live in, and a GitHub org. Without a system tying these together, knowledge scatters (the exact problem in the R2R proposal: "scattered decisions, weak documentation, AI without guardrails"). New developers also can't be expected to learn a hand-built harness — the entry point must be one simple prompt, not a manual checklist.

## Decision

Adopt a project operating system with **one front door and four surfaces**, governed by a single rule:

> **Notion explains · GitHub tracks · Slack coordinates · the repo enforces.**

Each fact lives in exactly one home. Duplicating it anywhere else is a bug.

**One front door — `/progix`.** A new project starts with a clone of the skeleton and one message: `/progix`. The skill runs an intake interview (ask as many questions as needed — easy to answer, never assumed), then: creates the GitHub repo under the `DigitariaWebs` org, creates and fills the Notion project from the canonical template, runs `/setup-project` to initialize the clone, and emits the Claude Design prompt as a clean copy-paste `.md`. It subsumes the old two-step kickoff (kickoff prompt + `/setup-project`), which remain as internal steps.

**Two workflows (from the R2R proposal):**

- **Initial Project Setup** — PRD → domain terms → ADRs → skeleton → SDD specs → tasks. Builds the foundation. Driven by `/progix` then `/write-prd` → `/create-spec`.
- **R2R (Requirement-to-Review)** — meeting intake → requirement diff (add/change/remove/reject) → grill (pre-mortem, success metrics, edge cases, review rubric) → spec/PRD update → GitHub issue → agent review → human merge. Protects the foundation as requirements churn. Driven by `/meeting-intake` → `/create-spec`/`/plan-feature`.

**Hard obligations (enforced regardless of the prompt).** AGENTS.md binds every change to: the skills, the reviewer agents, a spec (feature track), and a PRD as the product's source of intent. Agents may not bypass these even when a prompt omits them. See AGENTS.md → "Non-negotiable obligations" and Constitution Art. XI.

**Default automations (run without being asked).** A daily report agent compiles GitHub activity into a human report (Notion + repo). Serious problems (failing gate, security finding, broken CUJ) auto-file a GitHub issue — the harness does the boring bookkeeping so developers don't. Meeting transcripts convert to requirement diffs via `/meeting-intake`.

## Alternatives considered

| Option                                                               | Why not                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep Notion/GitHub/repo loosely coupled by convention                | The scattering problem persists; nothing enforces "one home per fact".                                                                                     |
| Heavy platform automation (hooks everywhere, custom backend) day one | The R2R proposal is explicit: pilot lightweight first, automate later. We use the tools the team already understands (gh CLI, Notion MCP, GitHub Actions). |
| Many entry-point skills devs must memorize                           | Defeats "perfect for new devs". One `/progix` front door; everything else is internal.                                                                     |

## Consequences

- Positive: a new dev ships from one prompt; the PM gets a readable Notion project without asking engineering; requirement churn is tracked, not lost; bookkeeping is automated.
- Negative / accepted: `/progix` depends on the Notion MCP being connected and `gh` being authed — the skill checks both and degrades to "describe the steps" if absent. Token cost of the daily report + persona review is bounded (scheduled once/day; CI gates run before AI).
- Follow-ups: keep the canonical Notion template (`docs/templates/notion-project-template.md`) and the live Notion master in sync; revisit automation depth after the first three `/progix` projects.
