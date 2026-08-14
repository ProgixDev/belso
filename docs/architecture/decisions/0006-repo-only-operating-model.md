# ADR-0006 — Repo-only operating model (drop cloud CI/CD + Notion/Slack)

- **Status:** accepted (partially supersedes [ADR-0005](0005-progix-operating-system.md))
- **Date:** 2026-06-18
- **Deciders:** Achraf Arabi (lead)

## Context

ADR-0005 adopted a "four-surface" operating system — Notion explains, GitHub tracks, Slack
coordinates, the repo enforces — plus cloud CI/CD (GitHub Actions for CI, e2e, Claude review,
daily report) and Notion-oriented templates. For a small team shipping many apps from this
skeleton, that machinery is overhead: it has to be kept in sync with the repo, adds ceremony,
and the cloud surfaces drift from the code that is the real source of truth.

This mirrors the decision taken in the Expo skeleton (its ADR-0008) so a developer moving
between web and mobile learns one operating model.

## Decision

**The repo is the only operating surface.** Remove the cloud ceremony; keep the local gates.

1. **Remove cloud CI/CD.** Delete the GitHub Actions workflows (`ci`, `e2e`, `claude-review`,
   `claude`, `daily-report`). Verification runs **locally**: `pnpm verify`
   (lint + typecheck + format + check:docs + check:typography + test + build) and Husky
   pre-commit hooks.
2. **Remove Notion + Slack.** Delete `docs/process/notion-workspace.md`, the
   `.claude/rules/notion-and-prd.md` rule, the `daily-reporter` agent, and the Notion-oriented
   templates. No four-surface bookkeeping; no "post it in the channel".
3. **Keep in-repo artifacts:** specs, ADRs, feature + daily reports (`docs/reports/`), the
   `specs/` track, the constitution, and the skills — de-Notioned during the docs/skill rebuild.
4. **Keep GitHub for code hosting** (PR template, CODEOWNERS) — hosting ≠ CI/CD.

## Consequences

- Faster, simpler loop; nothing to keep in sync outside the repo.
- No cloud enforcement — quality depends on local gates actually being run. The security work
  strengthens these local gates (secret scanning, security ESLint) precisely because there is no
  cloud backstop.
- Some leaf references to the old four-surface model remain in a few skills (`progix`,
  `meeting-intake`); these are retired during the skill rebuild.
