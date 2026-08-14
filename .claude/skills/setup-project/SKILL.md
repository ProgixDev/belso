---
name: setup-project
description: Initialize a fresh clone of the skeleton into a real project — interviews you for the product identity, then renames the app, fills docs/product/overview.md, sets CODEOWNERS, stubs the data-layer ADR and env vars, optionally removes the demo feature, and verifies everything is still green. Run ONCE, immediately after creating a repo from the template.
argument-hint: [project-name-kebab-case]
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep AskUserQuestion Bash(pnpm install*) Bash(pnpm verify*) Bash(pnpm exec playwright install*) Bash(pnpm lint*) Bash(pnpm test*) Bash(git status*) Bash(git add *) Bash(git commit *)
---

## Context

- Current package name: !`node -p "require('./package.json').name"`
- Git status: !`git status --short | head -5 || echo "no git repo"`

## Task

Turn this skeleton clone into project **$ARGUMENTS**. If the package name above is not `nextjs-skeleton`, this repo was already initialized — stop and confirm with the user before re-running anything.

### 1 · Interview (AskUserQuestion — don't guess any of these)

Collect in at most two rounds:

- **Identity:** project name (default `$ARGUMENTS`), one-sentence pitch, one-paragraph product description, primary user + what success looks like for them, 2–3 explicit anti-goals.
- **Data layer:** none yet (keep painted-door stubs) / Postgres + ORM / Supabase / Firebase / other. Plus auth: none yet / provider.
- **Demo feature:** keep `task-list` as the canonical pattern (recommended until the first real feature ships) or delete it now.
- **GitHub:** org/team handles for CODEOWNERS (e.g. `@acme/engineering`, `@acme/eng-leads`, `@acme/product`, `@acme/design-system`).

### 2 · Apply (small, reviewable edits — preserve all formatting conventions)

1. **Rename:** `package.json` name · `metadata` title/description in `src/app/layout.tsx` · README `# title` + first paragraph (keep the rest of README intact — it documents the workflow, which doesn't change).
2. **Product memory:** rewrite `docs/product/overview.md` from the interview — remove the placeholder banner; keep the section structure and glossary. This is the file every agent grounds on; make it specific.
3. **CODEOWNERS:** replace every `@your-org/*` placeholder with the real handles.
4. **Data layer & auth:** if chosen, create `docs/architecture/decisions/0005-data-layer.md` from the ADR template (status: Proposed — a human accepts it) and add the corresponding variables to BOTH `.env.example` and the zod schema in `src/core/env.ts`. Do not install or wire the dependency here — that's the first spec's job, with the ADR as its anchor.
5. **Skeleton-only files:** delete `docs/HANDBOOK.pdf` and `docs/handbook-src.html` (they document the skeleton itself, not this project).
6. **Demo feature, if deletion was chosen:** remove `src/features/task-list/`, `src/app/examples/`, `e2e/task-list.spec.ts`, the home-page card linking it; mark spec 001 `abandoned` in `specs/README.md`; move `docs/product/features/task-list.md` content to a one-line "removed at project init" note; update the CUJ table (CUJ-02 row) and `e2e/home.spec.ts` (it clicks into the example). Boundaries guarantee nothing else references the slice — verify with Grep anyway.

### 3 · Verify and hand off

- Run `pnpm install`, `pnpm exec playwright install chromium` (if browsers missing), then `pnpm verify`. Everything must be green — a red gate here means step 2 broke something; fix before proceeding.
- Commit as `chore: initialize project from skeleton` (one commit — reviewable as a unit).
- Report what was set, then list the steps only a human can do, with exact locations:
  1. Push and protect `main` (require the CI and E2E checks) — GitHub → Settings → Branches.
  2. Add the `ANTHROPIC_API_KEY` secret for persona reviews — run `/install-github-app` from Claude Code, or Settings → Secrets.
  3. Invite the CODEOWNERS teams.
- Close with: the project is ready for its first feature — run `/create-spec <idea>`.

Why this skill exists: a clone that skips these steps leaves agents grounding on placeholder product docs and skeleton branding — every future session inherits that confusion. Fifteen minutes here buys correctness for the life of the project.
