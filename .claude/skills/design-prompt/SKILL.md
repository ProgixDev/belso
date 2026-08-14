---
name: design-prompt
description: Generate a PROFESSIONAL Claude Design brief (token contract + anti-vibe-coding constraints) as a clean copy-paste .md for a web app. Use when the user says "design prompt", "design brief", "prompt for Claude Design", or is about to start the UI/UX pass. Design intent only — no code.
argument-hint: [project name]
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion, WebSearch
---

## Task

Produce `design/<project>-design-prompt.md` — a single copy-paste block for Claude Design that
produces **professional, not vibe-coded** pages. The difference between a cheap prompt and this one
is a pasted **token contract**, **specific reference/cultural anchors**, **mandatory states**, and an
explicit **DO-NOT list**.

1. **Read the bar + contract:** `docs/design/quality-bar.md`, `docs/templates/claude-design-prompt.md`,
   `docs/conventions/styling.md`, and `src/app/globals.css`. The brief MUST embed the real token
   contract and the DO-NOT list — never a generic "make it clean and modern".
2. **Source the product context** from the PRD (`docs/product/`) if present, else ask the user
   (AskUserQuestion) for: product + core action + emotional register; the pages to design; primary
   user + moment; tone words; 2–3 named reference products; optional cultural anchor. One round.
3. **Rebrand away from the defaults (critical):** the skeleton ships the **default shadcn neutral
   theme** — the recognizable AI tell. Instruct a distinctive palette for THIS app (replace the
   oklch role tokens; keep role names). For fast-moving platform patterns, a quick `WebSearch`.
4. **Fill the template** with this project's specifics: realistic sample data (never lorem), named +
   cultural anchors, the token contract as design values, required states for **every** page
   (incl. 404/500/auth/empty/loading/error), accessibility (keyboard + focus), the **DO-NOT** list.
   Keep the multi-pass + 3-directions + self-critique process.
5. **No-code rule (hard):** design intent only — no component names, props, class names, or code.
6. **Output:** clean Markdown, one copy-paste block; remind the user to attach 3–5 reference images.
