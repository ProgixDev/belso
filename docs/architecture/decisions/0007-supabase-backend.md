# 0007 — Supabase as the backend, RLS-first (SSR)

- **Status:** Accepted
- **Date:** 2026-06-19
- **Deciders:** Achraf Arabi (lead)

## Context

The skeleton was frontend-only. Web apps built from it need auth, a database, and payments, and
they handle PII. A browser ships a **public** anon key, so **Row-Level Security — not key secrecy —
is the authorization boundary.** This mirrors the Expo skeleton's ADR-0007 so one backend security
model spans web and mobile.

## Decision

Adopt Supabase with a **secure-by-default** data layer and **SSR cookie auth**:

1. **`@supabase/ssr` clients** — `src/lib/supabase/{client,server,middleware}.ts`. The browser
   client sets the auth cookies; `src/middleware.ts` refreshes the session on every request and
   gates protected routes; Server Components/Actions read the session via cookies.
2. **Deny-by-default DB** — migration `0001` revokes blanket grants, adds a `private` schema, and an
   **event trigger that auto-enables RLS on every new public table**. `0002` mirrors `auth.users`
   into `profiles`; `0003_notes` is the canonical owner-scoped CRUD pattern; `0004_subscriptions`
   is **server-owned** (client RLS SELECT-only; only the service-role writer updates entitlement).
3. **Secrets** — only `NEXT_PUBLIC_SUPABASE_*` reach the browser (public by design;
   `env.client.ts` refuses a service_role key). The service_role key is server-only
   (`src/core/env.ts` + `src/lib/supabase/admin.ts`, `server-only`), used for account deletion.
4. **Account deletion** — a server action (`deleteAccount`) deletes the user via the admin client;
   FK `ON DELETE CASCADE` removes their data.
5. **Verification** — pgTAP RLS tests (`supabase test db`) + `supabase db lint` (Security Advisor)
   block on ERROR lints 0007/0013/0015.

## Consequences

- A forgotten policy cannot silently leak data; the secure pattern is the path of least resistance.
- Every new table needs its grant + policies written deliberately — see `docs/architecture/backend.md`.
- Payments (Stripe) write entitlement only via a signature-verified server route (pattern documented).
