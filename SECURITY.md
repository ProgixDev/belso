# Security

This skeleton treats **anything sent to the browser as public and hostile**: the client bundle,
`NEXT_PUBLIC_*` vars, and "hidden" API routes are all reachable by an attacker. The real boundary
is the **server** — Server Components / Route Handlers / Server Actions that hold secrets and
enforce authorization (Supabase RLS once the backend lands). This file is the coverage map; the
enforceable rules live in [`docs/security/checklist.md`](docs/security/checklist.md) and the
rationale in [`docs/security/threat-model.md`](docs/security/threat-model.md).

## Reporting

Report vulnerabilities privately to **security@yourcompany.com** (TODO: set the real contact). Do
not open public issues for security reports.

## Coverage matrix

`[x]` baked in · `[~]` partial / later phase · `[ ]` not yet.

| Area                 | Control                                       | Status | How it's enforced                                                                 |
| -------------------- | --------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Secrets in code      | No hardcoded secrets / secret-looking env     | `[x]`  | `scripts/check-secrets.mjs` in `pnpm verify` + pre-commit; gitleaks (optional)     |
| Secrets at runtime   | `process.env` read only via server-only `env` | `[x]`  | `src/core/env.ts` imports `server-only` (client import = build error)             |
| Response headers     | HSTS, X-Frame-Options, nosniff, Referrer, PP  | `[x]`  | `next.config.ts` `headers()` on every route; CSP shipped report-only to tune      |
| Input validation     | Validate at every trust boundary              | `[x]`  | Zod schemas (AGENTS hard rule); Server Actions/Route Handlers parse input         |
| Open redirect        | No redirect to attacker-controlled URLs       | `[x]`  | `src/lib/redirect.ts` allowlist + tests                                            |
| Logging              | No tokens/PII in logs                         | `[x]`  | `src/lib/logger.ts` redacts tokens/PII/JWTs                                        |
| Auth / sessions      | Server-validated sessions; secure cookies     | `[~]`  | Phase 2 (Supabase SSR auth via `@supabase/ssr`, httpOnly cookies, middleware)     |
| Authorization        | RLS deny-by-default; never trust the client   | `[~]`  | Phase 2 (same RLS-first migrations as the Expo skeleton)                          |
| CSP (enforcing)      | Strict CSP with nonces                        | `[~]`  | Report-only baseline shipped; tighten + enforce per app                           |
| Rate limiting        | Throttle auth / mutation endpoints            | `[ ]`  | Pattern doc + per-app (e.g. Upstash) — backlog                                    |
| Supply chain         | Lockfile + audit + behavioral scan            | `[~]`  | Committed `pnpm-lock.yaml`; `pnpm audit` + Socket.dev — backlog                   |

## Non-negotiables (the short version)

- **No secrets in the repo or the client bundle.** `NEXT_PUBLIC_*` is public by definition; real
  secrets are read only through `src/core/env.ts` (`server-only`) and used in server code.
- **Validate every input** (Server Action args, Route Handler bodies, search params) with Zod.
- **Never trust the client for authorization** — the server (and Supabase RLS, Phase 2) decides.
- **No open redirects** — route user-supplied redirect targets through `safeRedirectPath`.
- **Treat AI-written code like a junior dev's PR**: run `/security-review` (skills) before merge.

## Local enforcement (no cloud CI — ADR-0006)

`pnpm verify` runs the full gate locally (lint, typecheck, format, docs, typography, secrets, test,
build). Pre-commit runs `lint-staged` + `check-secrets` (+ gitleaks if installed). Install the
optional deep scanner with `brew install gitleaks`; run it with `pnpm secrets:scan`.
