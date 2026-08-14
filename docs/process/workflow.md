# Team Workflow

How product owners, developers, testers, and designers work on this repo in parallel — with AI agents doing most of the typing — without stepping on each other.

## Roles (everyone drives agents; lenses differ)

| Role                   | Owns                                                     | Primary tools in this repo                                                                                                        |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Product owner / PM** | Problem definition, priorities, acceptance               | `/create-spec`, `/review` (product persona), `docs/product/`, reports in `docs/reports/`                                          |
| **Developer**          | Implementation quality, architecture, the harness itself | `/plan-feature`, `/implement-feature`, `/new-module`, `/encode-lesson`, ADRs                                                      |
| **Tester / QA**        | Verification strategy, CUJs, evidence                    | `/verify-ui`, `e2e/`, `docs/product/critical-user-journeys.md`, QA persona                                                        |
| **Designer**           | Experience quality, design system                        | painted-door experiments (`docs/process/painted-door.md`), `components/ui`, UX persona, `docs/conventions/styling.md` + `copy.md` |

The role boundary is **what you're accountable for reviewing**, not what you're allowed to touch. A PM can ship a feature via spec + agent; engineering is accountable for the harness catching what the PM can't see. When the agent fails someone, engineering fixes the harness — not the person.

## The two tracks (from AGENTS.md)

- **Quick track** — fix/copy/refactor: branch → implement → `pnpm verify` → PR. No spec, no report required.
- **Feature track** — anything new or structural:

```
PM/dev: /create-spec  →  specs/NNN-slug/spec.md     (what + why + acceptance criteria)
dev:    /plan-feature →  plan.md + tasks.md          (how; flags overlap with active specs)
agent:  /implement-feature                           (tasks, checkpoint commits, gates green)
agent:  /verify-ui    →  artifacts/screenshots/NNN-slug/   (evidence vs acceptance criteria)
agent:  /review       →  persona findings fixed (P0/P1)
agent:  /feature-report → docs/reports/NNN-slug.md   (diff + screenshots + verdicts)
merge:  local gates green (`pnpm verify` + pre-commit) + `/review` + human CODEOWNER
after merge: /update-docs → living feature doc, CUJs, INDEX updated; spec marked shipped
```

Verification runs **locally** (`pnpm verify` + Husky pre-commit), not in cloud CI. The repo is the
only operating surface — no Notion/Slack/GitHub-Actions layer (ADR-0006).

## Working without conflicts

1. **One feature = one slice = one branch.** Module boundaries make file collisions structurally impossible between features.
2. **Specs declare territory.** `spec.md` lists "areas touched"; `/plan-feature` checks active specs and flags overlaps _before_ code exists.
3. **Shared-layer changes ride alone.** Touching `components/ui`, `core`, configs, or CI is its own small PR, CODEOWNER-reviewed, merged fast so features rebase onto it.
4. **Rebase daily, merge small.** A branch older than two days is a process smell — split it.
5. **Docs and specs merge like code.** They live in the repo precisely so that review, history, and conflict resolution work the same way.

## Cadence (suggested)

- **Weekly planning:** specs reviewed as a team (the spec review _is_ the design review).
- **Demo on merge:** the feature report is the demo artifact — post it in the team channel.
- **Retro:** every recurring agent/human failure leaves with an `/encode-lesson` assignment. Measure the harness by how rarely the same feedback is given twice.

## Escalation

Disagreement about product behavior → PM decides (spec updated). About architecture → ADR proposed, engineering decides. About process → this file is the venue; change it by PR.
