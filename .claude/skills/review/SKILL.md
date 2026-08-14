---
name: review
description: Run the multi-persona review board on the current changes — frontend architecture, AppSec, QA, UX, and product lenses in parallel subagents — and consolidate findings by severity. Use before any PR, when the user says "review", "check my changes", "is this ready", or as the review phase of feature work.
argument-hint: [optional: base ref, default main]
---

## Context

- Diff stat: !`git diff --stat ${ARGUMENTS:-main}...HEAD 2>/dev/null | tail -20 || git diff --stat HEAD`

## Task

Convene the review board on the current branch's changes (base: `$ARGUMENTS` or `main`).

1. **Select reviewers by blast radius** (don't waste tokens on irrelevant lenses):
   - Any code → `frontend-architect`
   - Server actions, deps, env, CI, middleware → `appsec-reviewer`
   - Tests, features, CUJ-touching changes → `qa-verifier`
   - User-visible UI/copy (screenshots exist in `artifacts/screenshots/`) → UX lens
   - Feature-track work with a spec → product lens
2. **Dispatch subagents in parallel** — one per selected lens. `frontend-architect`, `appsec-reviewer`, and `qa-verifier` are defined in `.claude/agents/`; for UX and product, spawn general subagents instructed to _first read_ `docs/personas/ux-reviewer.md` / `docs/personas/product-reviewer.md` and follow them exactly. Each subagent gets: the base ref, the spec path (if any), and returns ONLY its formatted findings. Parallel subagents keep this conversation's context clean — that's why this isn't done inline.
3. **Consolidate** into one report, deduplicated, ordered P0 → P2, each finding with file:line and fix:

```
## Review board — <branch> vs <base>
Verdicts: arch ✗/✓ · sec ✓ · qa ✓ · ux ✓ · product ✓
### P0 (merge-blocking)   ### P1 (fix now)   ### P2 (follow-up)
```

4. **Drive resolution.** Fix P0s and P1s now (or hand to `/implement-feature`); list P2s for the PR's follow-ups section. Re-run the affected persona after fixes. A finding you disagree with → argue it explicitly in the report, don't silently drop it; the human reviewer arbitrates.
5. **Encode repeats.** Any finding a persona has now raised twice across PRs is harness debt → run `/encode-lesson` for it.

This board runs _before_ human review so humans spend attention on intent and taste, not on catchable defects.
