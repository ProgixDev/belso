# Threat model (web)

Apps built from this skeleton ship with auth, payments, and sensitive personal data. We assume a
motivated attacker who can read the client bundle and all network traffic, replay requests, and
hit any API route or Server Action directly (not just through the UI).

## Core principle

**Anything sent to the browser is public.** The client bundle, `NEXT_PUBLIC_*` vars, and "internal"
endpoints are all reachable. Client-side checks can be bypassed. The real security boundary is the
**server**: Server Components, Route Handlers, and Server Actions hold secrets and enforce
authorization; the server-only repository is the final gate — no browser holds a database credential (ADR-0008). Design every feature so that
a fully scripted client — never touching your UI — still cannot read or write data it shouldn't.

## Assets

1. **Credentials & sessions** — passwords, tokens, session cookies.
2. **Personal data (PII)** — anything identifying a user.
3. **Payment / entitlement state** — subscription status, receipts.
4. **Backend integrity** — the database, its least-privilege app role, and its backups.

## Trust boundaries & mitigations

- **Browser ↔ server** — the client is untrusted. Mitigations: secrets only in `server-only` env,
  Zod validation on every Server Action / Route Handler input, rate limiting on the one unauthenticated write path, security headers.
- **Server ↔ database** — Mitigations: parameterized queries only (`query(text, values)` is the sole entry point), a `belso_app` role that cannot read enquiries back or create databases, and a port bound to loopback.
- **Inbound redirects / links** — `?next=` params are untrusted. Mitigation: `safeRedirectPath`
  (no open redirect).
- **Auth callbacks (OAuth)** — Mitigation: PKCE + server-validated session, httpOnly secure cookies
  (spec 011; there is no session layer today).
- **Supply chain** — npm dependencies. Mitigations: committed lockfile, `pnpm audit`, behavioral scan.

## Data classification

| Class               | Examples                                    | Where it may live                                           |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| **Secret**          | tokens, API keys, service_role key          | server only (via `src/core/env.ts`); never logs/bundle      |
| **Sensitive (PII)** | name, email, phone, enquiry prose           | server only; the app role can insert but never read it back |
| **Public-config**   | `NEXT_PUBLIC_*`, anon/publishable key, URLs | the bundle is fine (public by design)                       |
| **Non-sensitive**   | UI prefs, caches                            | client storage is fine                                      |

## Out of scope (accepted)

- Reverse-engineering client logic (assumed possible; keep nothing security-critical on the client).
- A user attacking their own session in their own browser.

See the enforceable controls in [`checklist.md`](checklist.md).
