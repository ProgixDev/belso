---
name: verify-ui
description: Prove UI work actually works by running Playwright CUJ tests, capturing screenshots, and visually inspecting them against the spec's acceptance criteria. Use after any UI change — when the user says "verify", "check the UI", "does it work", "screenshots" — and always as the verification phase of feature work. Never declare UI work done without this.
argument-hint: [spec number/slug, or blank for all CUJs]
allowed-tools: Bash(pnpm e2e*) Bash(pnpm exec playwright*) Read Glob Grep
---

## Task

Verify the running app for **$ARGUMENTS** with evidence, not vibes.

1. **Identify scope.** From the spec (or, if no spec, the current diff via `git diff --stat main`), list the CUJs touched (`docs/product/critical-user-journeys.md`). New user-visible behavior with no CUJ/e2e coverage → write the e2e spec first (see `.claude/rules/testing.md`); that gap is itself a finding.
2. **Run:** `FEATURE=<slug> pnpm e2e:shots` (or `pnpm e2e:shots` for the full baseline). Screenshots land in `artifacts/screenshots/<slug>/`. If the run fails, debug from the Playwright report/trace — failures here are the loop closing, which is the point.
3. **Look at every screenshot** (use the Read tool — actually look). Judge against: the spec's acceptance criteria, `docs/conventions/styling.md` (states, drift), `docs/conventions/copy.md` (typography, tone). Check the unglamorous shots hardest: empty, error, loading.
4. **Attest honestly.** Produce:

```
## UI verification — <slug> (<date>)
| AC | Evidence (shot/test) | Verdict |
|----|----------------------|---------|
| AC-1 | tasks-add.png / task-list.spec step 2 | PASS |
…
Issues found: (file:line or shot name → what's wrong)
Verdict: VERIFIED | ISSUES FOUND (n)
```

5. **Close the loop.** Issues found → fix them (or hand back to `/implement-feature`) and re-run until VERIFIED. The screenshots you finish with are the evidence `/feature-report` will publish — leave them in place.

An agent attesting "verified" with failing or unexamined shots is the single worst trust violation in this harness. When in doubt, mark ISSUES FOUND.
