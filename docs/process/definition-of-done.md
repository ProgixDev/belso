# Definition of Done

A change is **done** when every line below is true. The PR template mirrors this list; reviewers and agents enforce it. "Works on my machine" and "the agent said it's done" are not evidence.

## Every change (both tracks)

- [ ] `pnpm verify` passes locally (lint, typecheck, format, docs check, typography check, unit tests, build)
- [ ] Conventional commit(s); branch named per `docs/conventions/git.md`
- [ ] No new lint suppressions, `@ts-expect-error`s, or gate weakenings — or each one is justified in the PR description
- [ ] Tests updated/added: bug fixes carry a regression test; behavior changes update the tests that encode that behavior
- [ ] No secrets, PII, or `.env*` content anywhere in the diff
- [ ] Docs touched if behavior/structure changed (the doc you'd expect a newcomer to read must not lie)

## Feature track, additionally

- [ ] Spec exists in `specs/NNN-slug/` with acceptance criteria; plan + tasks completed (checkboxes ticked)
- [ ] Every acceptance criterion maps to a passing test (unit or e2e) — the mapping is in `tasks.md`
- [ ] `/verify-ui` run: CUJ e2e green, screenshots captured to `artifacts/screenshots/NNN-slug/` and _looked at_
- [ ] `/review` run: persona P0/P1 findings fixed (P2s ticketed or consciously declined in the PR)
- [ ] `/feature-report` generated → `docs/reports/NNN-slug.md` linked in the PR
- [ ] After merge: `/update-docs` run — feature doc, CUJs, INDEX current; spec marked shipped

## UI changes, additionally

- [ ] Empty, loading, and error states implemented and screenshotted
- [ ] Keyboard path works; focus visible; labels present
- [ ] Copy follows `docs/conventions/copy.md` (typography gate green)
- [ ] Reduced-motion behavior verified for new animations

## The spirit clause

If you find a way to satisfy the letter of this list while shipping something you wouldn't defend in demo, the harness has a bug: run `/encode-lesson` and close it.
