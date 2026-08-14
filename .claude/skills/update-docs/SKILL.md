---
name: update-docs
description: Close the documentation loop after a feature ships — distill the spec into the living feature doc, update CUJs and indexes, mark the spec shipped. Use after merge, when the user says "update docs", "docs pass", "close out the feature", or when docs have drifted from reality. Stale docs poison every future agent session, so this is maintenance of the harness itself.
argument-hint: [spec number/slug, or "audit" for a drift check]
allowed-tools: Read Write Edit Glob Grep Bash(pnpm check:docs*) Bash(git log*) Bash(git diff*)
---

## Task

For **$ARGUMENTS**:

### Mode A — close out a shipped spec (default)

1. **Distill, don't copy.** Read the spec folder + final diff. Write/update `docs/product/features/<slug>.md` using the template in `docs/product/features/README.md`: what it does (user terms), how it works (the non-obvious 20%), dated decisions & gotchas, CUJs covered. The feature doc is what future changers ground on — capture what they'd otherwise rediscover painfully, omit what the code says plainly.
2. **Update the registries:** feature index in `docs/product/features/README.md` · CUJ table in `docs/product/critical-user-journeys.md` (new/changed journeys with spec + screenshot names) · spec status → `shipped` in `specs/README.md` · `docs/INDEX.md` if files were added.
3. **Check for ripples:** did this work invalidate any statement in `docs/architecture/*` or `docs/conventions/*`? Fix in place; if a _decision_ changed, that's a superseding ADR, not a silent edit.
4. **Validate:** run `pnpm check:docs` (link integrity). Commit as `docs(<slug>): close out spec NNN`.

### Mode B — `audit` (drift check)

Sweep for lies: feature docs vs actual slices (`ls src/features`), CUJ table vs `e2e/` specs, specs index vs spec folders' real status, INDEX vs files on disk, dead links (`pnpm check:docs`). Report a fix-list ordered by how badly each lie would mislead an agent, then fix the approved ones.

Tone rules for all docs: short, imperative, present tense, no marketing. If a doc passes 200 lines, split it and re-index.
