---
name: implement-feature
description: Execute a planned spec task-by-task with gates green at every step. Use when a spec has plan.md + tasks.md and the user says "implement", "build it", "execute the plan", or names the spec. This is the long-running workhorse — it ticks tasks.md checkboxes, makes checkpoint commits, and ends by chaining verification.
argument-hint: [spec number or slug]
---

## Task

Implement spec **$ARGUMENTS** by executing its `tasks.md` top to bottom.

### Operating rules

1. **Ground first.** Read the spec folder (spec/plan/tasks) fully, then the docs the plan cites. The path-scoped rules in `.claude/rules/` will load as you touch files — follow them; they digest the conventions reviewers will enforce.
2. **One task at a time.** Work strictly in tasks.md order (parallelize only `[P]` tasks). For each task: implement → run its done-check → tick the checkbox in tasks.md → conventional checkpoint commit (`feat(slug): T3 …`). The ticked file is the durable progress record — after any context compaction, re-read tasks.md to recover state instead of guessing.
3. **Keep gates green.** `pnpm lint && pnpm typecheck && pnpm test` after every task; `pnpm verify` at phase ends. A red gate is the harness prompting you — fix the work, never the gate (Constitution Art. IV). If a gate seems genuinely wrong, stop and surface it to the user.
4. **Stay in scope.** The spec's _Out of scope_ list is binding. If implementation reveals a needed scope change, stop, say so, and update the spec with the user — don't ship surprises (they arrive as unreviewed product surface).
5. **Imitate the canon.** When unsure how something should look here, copy the patterns of `src/features/task-list/` rather than inventing. Consistency is a feature: the next agent greps this codebase to learn it.
6. **Blocked?** Two failed attempts on the same task → stop, write what you tried and your best hypothesis, ask. Don't burn the context window thrashing.

### Exit

When all tasks through phase 2 are ticked: run `/verify-ui $ARGUMENTS`, then `/review`, then `/feature-report $ARGUMENTS` (phase 3 tasks). Report: tasks completed, gates status, anything deferred, and the PR-readiness checklist from `docs/process/definition-of-done.md`.
