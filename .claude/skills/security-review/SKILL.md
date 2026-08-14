---
name: security-review
description: Review the current branch's diff against the project security checklist (SEC-* rules) and report findings with rule IDs + a verdict. Use before merging anything touching env/secrets, Server Actions, Route Handlers, auth, redirects, headers, or migrations.
argument-hint: [base branch, default main]
allowed-tools: Read, Grep, Glob, Bash(git diff*), Bash(git log*), Bash(pnpm run secrets:check*), Bash(node scripts/check-secrets.mjs*)
---

## Context

- Changed vs base: !`git diff --stat ${ARGUMENTS:-main}...HEAD 2>/dev/null | tail -40 || git diff --stat HEAD`

## Task

Audit the diff against `docs/security/checklist.md` (the `SEC-*` catalog) and
`docs/security/threat-model.md`. **Treat AI-written code like a junior dev's PR — be skeptical.**

1. Read `docs/security/checklist.md`. Run `node scripts/check-secrets.mjs`.
2. Diff the branch (`git diff ${ARGUMENTS:-main}...HEAD`). Prioritize files touching: env/secrets
   (`src/core/env*.ts`), `src/lib/supabase/*`, Server Actions, Route Handlers (`src/app/api/*`),
   `src/middleware.ts`, redirects, `next.config.ts`, `supabase/migrations`.
3. Explicitly verify the high-leverage rules:
   - No secret in source/bundle; no secret-looking `NEXT_PUBLIC_*` (SEC-SECRET-*). `process.env` only
     via `env.ts`/`env.client.ts` (SEC-ENV-001).
   - service_role key used only in server code (SEC-SECRET-003).
   - New tables: RLS + owner-scoped policies + `WITH CHECK`; never trust the client (SEC-RLS / AUTHZ).
   - Inputs Zod-validated; redirects via `safeRedirectPath` (SEC-INPUT-001, SEC-REDIR-001).
   - Security headers intact (SEC-NET-001).
4. Report each finding on one line: `[P1|P2|P3] SEC-ID — file:line — issue — concrete fix`.
5. End with `## Verdict: APPROVE | REQUEST-CHANGES` (any P1 ⇒ REQUEST-CHANGES) and, under
   `## Harness:`, propose a lint rule / test / hook for anything likely to recur.
