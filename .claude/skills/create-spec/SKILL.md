---
name: create-spec
description: Start feature-track work by turning an idea into a reviewable spec in specs/NNN-slug/. Use whenever the user describes a new feature, capability, experiment, or user-visible change — phrases like "build", "add a feature", "I want users to be able to", "let's spec" — and no spec exists yet. Do NOT use for bug fixes or small tweaks (quick track needs no spec).
argument-hint: [feature idea in one sentence]
allowed-tools: Read Grep Glob Write AskUserQuestion
---

## Context

- Existing specs: !`ls -1 specs | grep -E '^[0-9]' || echo "none yet"`
- Active feature slices: !`ls -1 src/features 2>/dev/null || echo "none"`

## Task

Create `specs/NNN-slug/spec.md` for: **$ARGUMENTS**

1. **Read first:** `specs/TEMPLATE/spec.md` (the format), `specs/README.md` (lifecycle), `docs/product/overview.md` and `docs/product/critical-user-journeys.md` (product fit). Number = next integer after the existing specs above.
2. **Interview, don't guess.** Use the AskUserQuestion tool for the decisions only the requester can make — target users, the non-happy paths, what's explicitly out of scope, feature vs experiment, CUJ impact. Two rounds max; if something stays open, record it under _Open questions_ instead of inventing an answer. A wrong assumption written confidently is the most expensive failure mode of spec work.
3. **Write the spec** from the template. Keep it one page. Behavior in user terms only — no component names, no tech choices (that's plan.md's job). Acceptance criteria must be independently testable and include at least one non-happy path. Fill _Slice / areas touched_ honestly — it's the input for cross-spec conflict detection.
4. **Register it:** add a row to the index table in `specs/README.md` with status `draft`.
5. **Hand off:** tell the user the spec path, summarize the ACs in two lines, list any open questions, and point to `/plan-feature NNN` as the next step (after the spec owner approves the draft).

Quality bar: a teammate who has never heard of this idea could read the spec and either build the right thing or disagree with it concretely. Out-of-scope and edge cases matter more than the happy path — that's where agents drift.
