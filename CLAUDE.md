@AGENTS.md

## Claude Code specifics

- Path-scoped rules in `.claude/rules/` load automatically when you touch matching files — they are digests; the full source of truth is `docs/`.
- Hooks (in `.claude/settings.json`) auto-format files you edit and block writes to protected paths. If a hook blocks you, it is intentional — read its message instead of working around it.
- Use **plan mode** (Shift+Tab) before touching `src/core/`, `.github/workflows/`, or any ESLint/CI gate.
- Delegate noisy work (broad searches, log-heavy runs, persona reviews) to subagents in `.claude/agents/` to keep the main context clean. `/review` does this for you.
- For long autonomous runs, re-read the active spec's `tasks.md` after compaction and keep its checkboxes as the source of truth for progress.
