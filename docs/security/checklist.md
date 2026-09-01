# Security checklist (rule catalog)

Queryable rule file. Severity: **P1** block-release · **P2** fix-before-merge · **P3** improve.
"Enforced" = the automated mechanism; "manual" rules are checked in review / by `/security-review`.

`id | severity | rule | how to verify | enforced by`

```
SEC-SECRET-001 | P1 | No hardcoded secrets (database passwords, Stripe sk_, any provider token) in source or the client bundle | pnpm secrets:check; pnpm secrets:scan | check-secrets + gitleaks
SEC-SECRET-002 | P1 | No NEXT_PUBLIC_* var whose name implies a secret (SECRET/TOKEN/SERVICE_ROLE/PASSWORD/PRIVATE) | pnpm secrets:check | check-secrets
SEC-ENV-001    | P1 | process.env is read ONLY through src/core/env.ts (server-only); client never imports it | grep for process.env outside env.ts; build fails on client import | server-only + review
SEC-SECRET-003 | P1 | Secret keys (service_role, Stripe sk_) used only in server code (Server Actions / Route Handlers) | review server/client split | review
SEC-NET-001    | P1 | Security headers set on every route (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | inspect next.config.ts headers() / response headers | next.config + review
SEC-NET-002    | P2 | CSP tightened and switched from Report-Only to enforcing (nonces/hashes for inline) | check Content-Security-Policy header | review (per app)
SEC-INPUT-001  | P1 | Every trust-boundary input (Server Action args, Route Handler body, searchParams) passes a Zod schema | review input parsing | review (AGENTS hard rule)
SEC-REDIR-001  | P1 | User-supplied redirect targets go through safeRedirectPath (no open redirect) | redirect.test.ts; grep redirect()/NextResponse.redirect | tests + review
SEC-AUTHZ-001  | P1 | Authorization enforced server-side. No browser holds a database credential (ADR-0008 removed RLS); every public read filters publication='published' inside repository.ts, once, never at a caller | review repository.ts + Server Actions | review
SEC-AUTH-001   | P1 | Sessions are server-validated; cookies are httpOnly + secure + sameSite. The layer landed with spec 011 (ADR-0011): a hashed token in a table, checked per request, so disabling an account takes effect immediately. proxy.ts only checks that a cookie exists — the authority is the admin layout for pages and requireSession() inside every action for mutations, because an action is reachable without its page | session.test.ts; admin-actions.test.ts derives the action list from the module | review + tests
SEC-AUTH-002   | P1 | Anything that invalidates a credential destroys the sessions issued under it — a password change as surely as a disable, or the cookie the reset was meant to defeat stays valid for its full lifetime | scripts/admin-user.mjs revokeSessions() | review
SEC-LOG-001    | P2 | No tokens/PII in logs; use the redacting logger for auth/network data | grep console.* near auth/network | logger + review
SEC-CSRF-001   | P2 | State-changing requests are CSRF-safe (Server Actions are by default; custom Route Handlers verify origin/token) | review non-Action mutations | review
SEC-SUPPLY-001 | P2 | Lockfile committed; deps reviewed; pnpm audit clean of highs | pnpm audit; review package.json diff | review
SEC-DB-001     | P1 | No database container publishes a port on 0.0.0.0. Docker writes its iptables rules ahead of ufw, so a published port is public even with the firewall denying — this is exactly how n8n came to serve its login over plain HTTP. Bind to 127.0.0.1 and reach it over SSH | ss -tlnp on the VPS; docker compose ports: entries | docs/security/vps.md + review
SEC-DB-002     | P2 | Backups are verified by restoring one, not by inspecting the file, and personal data past its retention date is deleted before the dump — not after | pnpm db:restore-check | scripts/vps/belso-backup.sh
SEC-RATE-001   | P2 | Unauthenticated mutations are rate-limited in shared storage, not per-process, and count attempts as well as writes. Sign-in counts on two axes — by account and by network — because either alone leaves a hole, and they use separate tables so the role that writes one cannot reset the other | enquiries.db.test.ts; login-throttle.db.test.ts | Postgres counter (specs 010, 011)
SEC-RATE-002   | P2 | A throttle key derived from personal data (email, IP) is HMAC'd, never a bare hash — a bare hash of a guessable value makes the table that prevents enumeration enumerable. THROTTLE_SECRET is required in production | login-throttle.db.test.ts asserts the key is not a bare hash of the address; env.test.ts asserts the production guard | env.ts guard + tests
SEC-RATE-003   | P3 | Limiters keyed on X-Forwarded-For are only as trustworthy as the proxy in front. Confirm Traefik sanitises client-supplied forwarded headers before relying on the network axis for anything | not yet verified — see docs/security/vps.md | review
```

## How `/security-review` uses this

The `/security-review` skill diffs the branch, evaluates each touched area against these rules, and
reports findings as `[P1|P2|P3] SEC-… — file:line — issue — fix`, then a verdict (any P1 ⇒
REQUEST-CHANGES). Until then, run the checklist by hand on anything touching env/secrets, Server
Actions, Route Handlers, auth, redirects, or headers.
