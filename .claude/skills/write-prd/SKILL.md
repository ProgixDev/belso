---
name: write-prd
description: Turn project context (intake answers, meeting transcripts, the cadrage doc) into a clear Product Requirements Document. Use when starting a project, when /progix needs the PRD, or when the user says "write the PRD", "draft requirements", or requirements changed enough to need a rewrite. The PRD is the product's source of intent — what and why, before how.
argument-hint: [project name or "from <context path>"]
allowed-tools: Read Write Edit Glob Grep AskUserQuestion
---

## Task

Produce the PRD for **$ARGUMENTS** at `docs/product/prd.md` (the repo mirror; the human original lives in Notion → project → PRD).

1. **Gather intent, not solutions.** Read everything the user has: intake answers, pasted transcripts, the PM cadrage doc, `docs/product/overview.md`. The PRD captures the problem and the what/why — keep tech choices out (those are ADRs + specs).
2. **Read the template** `docs/templates/prd.md` and follow its structure exactly: problem & opportunity · goals & non-goals · users & jobs · MVP scope (ranked) · constraints · success metrics · open questions · decision log.
3. **Interview only for gaps** (AskUserQuestion): the non-goals, the success metrics, and the single signature feature are the parts requesters most often skip and matter most — pull them out. Anything still open becomes an Open Question, not an assumption.
4. **Keep it one page** where the product allows. The PRD is read by the client and the PM — plain language, honest scope. Non-goals are as important as goals: they're how budget and timeline survive.
5. **Map forward.** Each MVP scope item should be phrasable as one or more specs — end by listing the first 2–3 `/create-spec` candidates, ranked.
6. Mirror the human original into Notion if the MCP is connected (or stage it for `/progix` to place).

A good PRD lets `/create-spec` run without re-litigating product questions — that's the test.
