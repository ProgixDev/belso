---
name: plan-feature
description: Turn an approved spec into plan.md + tasks.md ready for implementation. Use when a spec exists and the user says "plan", "how should we build", "break this down", or names a spec number. Resolves open questions, checks conflicts with other active specs, and maps every acceptance criterion to a test before any code is written.
argument-hint: [spec number or slug]
allowed-tools: Read Grep Glob Write AskUserQuestion
---

## Context

- Specs: !`ls -1 specs | grep -E '^[0-9]' || echo "none"`
- Active slices: !`ls -1 src/features 2>/dev/null`

## Task

Plan spec **$ARGUMENTS**: produce `plan.md` and `tasks.md` next to its `spec.md`.

1. **Gate on the spec.** Read the spec. If _Open questions_ is non-empty or ACs are untestable, stop and resolve them with the user (AskUserQuestion) — update the spec first. Planning against an ambiguous spec produces confident garbage.
2. **Ground in architecture.** Read `docs/architecture/module-boundaries.md`, `docs/architecture/overview.md`, the conventions relevant to the work, and skim `src/features/task-list/` as the canonical slice. If the plan needs a new dependency or a boundary exception, draft the ADR (in `docs/architecture/decisions/`) as part of the plan — do not bury architectural decisions inside a feature plan.
3. **Conflict check.** Compare this spec's _areas touched_ against every other spec with status `active` in `specs/README.md`. Overlap → flag it in plan.md's _Overlap check_ with a resolution (sequence, coordinate, or split), and tell the user.
4. **Write plan.md** from `specs/TEMPLATE/plan.md`. The AC→verification table is the heart: every AC names the exact test file/step that will prove it. An AC with no test is a planning failure, not a detail.
5. **Write tasks.md** from `specs/TEMPLATE/tasks.md`: ordered, ≤30-min tasks, files named, done-check per task, `[P]` where parallel-safe. Phases: setup → core behavior → verification → review & ship. The verification and review phases are not optional padding — they are where the OpenAI-style harness earns its keep.
6. **Flip status** to `active` in `specs/README.md` and report: plan summary (3 lines), risk list, and "run `/implement-feature $ARGUMENTS` to execute".

Plans are reviewed by humans — keep both files lean enough to be read honestly in five minutes.
