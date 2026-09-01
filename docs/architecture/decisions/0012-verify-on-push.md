# 0012 — Run `pnpm verify` on push, on a clean checkout

- **Status:** Proposed
- **Date:** 2026-09-01
- **Deciders:** Houssem Ferrani — **needs Achraf Arabi, who decided [ADR-0006](0006-repo-only-operating-model.md)**
- **Amends:** [ADR-0006](0006-repo-only-operating-model.md), decision point 1, narrowly

## Context

ADR-0006 deleted the GitHub Actions workflows and moved verification to `pnpm verify` plus Husky
hooks. Its reasoning holds and this does not dispute it: the cloud surfaces it removed — Notion,
Slack, a review bot, a daily report — were **duplicated state**, things that had to be kept in
sync with a repository that was already the source of truth. Its own consequences section names
the price it accepted: "quality depends on local gates actually being run."

Spec 011 found the failure mode that price buys, and it is narrower than "somebody forgot to run
the gates". `pnpm verify` passed locally and the same command failed on a clean clone. The
back-office was being prerendered, hit an unset `DATABASE_EDITOR_URL` and failed the whole build —
invisible on any machine with a `.env.local`, which is every machine that has ever run the project.
It reached a pushed branch and was fixed in `f1274de`. Nothing local could have caught it, because
the thing that differs is the absence of local state.

The same shape recurred three times during this spec: a guard reading a variable the server never
used, a setup concluding "no database" while one was connected, and a database suite that skipped
itself entirely after a dead import survived a refactor. Each was green. Each was green because of
something present on the machine that ran it.

## Decision

Add **one** workflow that runs `pnpm verify` on push and pull request. Nothing else: no e2e, no
review bot, no reporting, no deployment, no secrets.

The distinction from ADR-0006 is that this creates **no second surface**. It runs the same command
a developer runs, reports pass or fail, and holds no state anybody has to reconcile. What it adds
is the one condition local gates structurally cannot reproduce: a checkout with nothing on it.

## Alternatives considered

| Option                                     | Why not                                                                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leave it as ADR-0006 has it**            | Defensible, and the status quo. It accepts that a clean-clone break reaches a branch and is found by whoever next clones — which for a solo project can be weeks, and was three days here.                                                   |
| **A Husky pre-push hook doing the same**   | Runs on the machine that already has `.env.local`, so it reproduces the local environment exactly — the one thing that must not be reproduced. It would have passed on the failure that motivated this.                                      |
| **Also run e2e in CI**                     | Needs Postgres, a browser download and the admin credentials. It would turn a thirty-second check into a fixture-management project and start needing secrets, which is where ADR-0006's objection genuinely applies. Locally, deliberately. |
| **Restore the workflows ADR-0006 deleted** | Those included a review bot and a daily report — duplicated state, exactly what 0006 was right to remove. This is not that, and should not become that.                                                                                      |

## Consequences

- Positive: a clean-checkout build is verified on every push, which is the one gate a developer
  cannot run against their own machine. No secrets, so it works on a fork and cannot leak anything.
- Negative / accepted trade-offs: ADR-0006's "the repo is the only operating surface" becomes "the
  repo is the only operating surface, plus one check that runs the repo's own command". That is a
  real weakening of a clean principle, and it is the reason this ADR exists rather than a quiet
  commit. It also puts a green tick on a pull request, and a tick invites trusting it — this one
  attests `pnpm verify` and **not** e2e, `test:db`, or anything requiring a database.
- Follow-ups: if it ever grows a second job, that is a new decision, not a maintenance edit.
