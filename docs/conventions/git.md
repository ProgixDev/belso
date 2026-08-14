# Git & PR Conventions

## Branching — trunk-based, short-lived

- `main` is always releasable; protected (PR + green CI required, no direct pushes).
- Branches: `feat/NNN-slug` (matches spec number), `fix/slug`, `chore/slug`, `docs/slug`. Lifespan target: < 2 days. Big features land as a sequence of small PRs behind the painted-door pattern, not one mega-branch.
- Rebase on `main` before review; squash-merge with a conventional title. No merge commits on `main`.

## Conventional commits (enforced by commitlint)

```
<type>(<scope>): <imperative summary ≤ 72 chars>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`. Scope = feature slug or area (`task-list`, `harness`, `ci`). Body explains _why_ when non-obvious. `BREAKING CHANGE:` footer when contracts change.

## Pull requests

- Small: aim < 400 changed lines (generated files excluded). Split by layer or by task from `tasks.md`.
- The PR template is mandatory: link the spec (feature track), check the Definition of Done, attach screenshots / `docs/reports/` link for UI changes.
- One PR = one intent. Drive-by refactors go in their own `refactor:` PR.
- Review order: CI gates → AI persona review → human CODEOWNER. Address P0/P1 persona findings before requesting human review (that's what keeps human review fast).
- Agents: commit as you complete tasks from `tasks.md` (checkpoint commits), never `--force` push shared branches, never amend others' commits, never commit secrets or `artifacts/`.

## Conflict avoidance (how parallel work stays safe)

1. Feature slices: two features never touch the same files (boundaries-enforced).
2. Specs claim scope: `/create-spec` lists "files/areas touched"; overlapping active specs get flagged at plan time.
3. Shared layers (`components/ui`, `core`, configs) change in dedicated small PRs with CODEOWNER review — never inside a feature PR.
4. Short branch lifespan beats merge tooling. Rebase daily.
