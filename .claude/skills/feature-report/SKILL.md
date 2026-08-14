---
name: feature-report
description: Generate the evidence report for a feature — diff summary, screenshots, AC-to-test traceability, verification verdicts — into docs/reports/NNN-slug.md (the artifact PMs and reviewers actually read). Use when feature work is verified and the user says "report", "feature report", "document what we did", or as the reporting phase before a PR.
argument-hint: [spec number or slug]
allowed-tools: Read Write Glob Grep Bash(git diff*) Bash(git log*) Bash(cp *) Bash(mkdir *) Bash(pnpm report:pdf*)
---

## Context

- Branch & changes: !`git branch --show-current && git diff --stat main...HEAD | tail -5`
- Available screenshots: !`ls -R artifacts/screenshots 2>/dev/null | head -30 || echo "none — run /verify-ui first"`

## Task

Produce `docs/reports/<NNN-slug>.md` for **$ARGUMENTS**, following the exact structure in `docs/reports/README.md`.

1. **Gather inputs:** the spec folder (spec/plan/tasks), the real diff (`git diff main...HEAD`, plus `git log --oneline main...HEAD`), the `/verify-ui` attestation, and the screenshots in `artifacts/screenshots/<slug>/`. No screenshots → stop and run `/verify-ui` first; a report without evidence is marketing.
2. **Curate evidence:** `mkdir -p docs/reports/<slug>/img` and copy ONLY the screenshots referenced by the report (artifacts/ itself stays gitignored). Reference them with relative paths.
3. **Write the report** — sections in order: header (spec link, branch, date) · what & why (3 sentences from the spec, no marketing voice) · **AC → evidence table** (every AC: the test that proves it + screenshot + verdict — this table is the report's reason to exist) · screenshots with one-line captions (before/after when modifying existing UI) · changes by layer with notable decisions from the actual diff · verification summary (gates, e2e, persona verdicts) · follow-ups (declined P2s, ticketed items).
4. **Honesty rules:** verdicts come from real runs, not optimism; unresolved issues appear under follow-ups, not omitted; numbers (files changed, tests added) come from git, not estimates.
5. **Offer the PDF:** `pnpm report:pdf <slug>` renders it via `scripts/report-to-pdf.mjs` for sharing outside the repo.
6. Link the report in the PR description and in `specs/README.md`'s row for this spec.

Write for a reader who was on holiday during the work: by the end they know what shipped, proof it works, and what's consciously left open.
