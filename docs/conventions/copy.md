# Copy & Typography Conventions

User-facing text is product surface, not string literals. These rules are partially machine-enforced by `pnpm check:typography` (CI + pre-commit).

## Typography (enforced)

- **Curly quotes and apostrophes** in all user-visible text: `“ ” ‘ ’` — never straight `"` `'`. (JSX text nodes are scanned; code stays straight-quoted, obviously.)
- Real ellipsis `…`, not `...`. Em dash `—` with no surrounding spaces for breaks; en dash `–` for ranges.
- Non-breaking space between numbers and units (`10 MB`), and before `?`/`!` is _not_ used (English rules).
- Escape hatch for false positives: add `{/* typography-ok */}` on the line above; the checker skips it. Use sparingly — each use is reviewed.

## Voice & tone

- Sentence case everywhere: buttons, titles, labels (“Create task”, not “Create Task”).
- Verb-first buttons (“Save changes”), specific over generic (“Delete 3 tasks” over “Confirm”).
- Errors: say what happened + what to do next, in human words. Never expose raw error codes/stack traces; never blame the user.
- Empty states teach: one line of what goes here + the primary action.
- No filler (“please note”, “simply”), no exclamation marks in errors, no jargon the user didn't introduce.

## Mechanics

- All user-visible strings live in components/feature files (not buried in libs) so the typography checker and future i18n extraction can find them.
- Dates/numbers via `Intl.*` formatters in `src/lib/format.ts` — never hand-rolled.
- Writing or reviewing copy? The `/review` UX persona checks against this file.
