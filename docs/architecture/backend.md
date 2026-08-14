# Backend (Supabase, SSR)

The backend is Supabase, configured **RLS-first** with **SSR cookie auth** (ADR-0007). Golden rule:
**the browser is untrusted and ships a public key — Postgres Row-Level Security is the
authorization boundary, not the client.**

## Clients (`src/lib/supabase/`)

- **`client.ts`** — browser client (`createBrowserClient`) for Client Components. Sets auth cookies.
- **`server.ts`** — server client (`createServerClient` + `next/headers` cookies) for Server
  Components, Server Actions, and Route Handlers. Reads the session; RLS enforces access.
- **`middleware.ts`** + **`src/middleware.ts`** — refresh the session on every request and redirect
  unauthenticated users away from protected routes (`PROTECTED_PREFIXES`). Always returns the
  `supabaseResponse` so cookies stay in sync. **Do not** run code between `createServerClient` and
  `auth.getUser()`.
- **`admin.ts`** — service-role client (`server-only`); **bypasses RLS**. Use sparingly (account
  deletion). Never expose it or the key to the browser.

## Auth (`src/features/auth/`)

`SignInForm` (client) uses the browser client to sign in/up (Zod-validated). `signOut` and
`deleteAccount` are server actions; `/account` is a Server Component guarded by the middleware and
re-checked server-side. The `?next=` redirect target is sanitised by `safeRedirectPath`.

## Database — secure-by-default rules

Migrations in `supabase/migrations/` run in order. `0001_security_baseline` enforces deny-by-default:
blanket grants revoked, RLS auto-enabled on every new public table, a `private` schema for
`security definer` helpers (`search_path = ''` pinned).

### Adding a per-user table (copy `0003_notes`)

```sql
create table public.things (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.things to authenticated;
create index things_user_id_idx on public.things (user_id);
create policy "things: select own" on public.things for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "things: insert own" on public.things for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "things: update own" on public.things for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "things: delete own" on public.things for delete to authenticated
  using ((select auth.uid()) = user_id);
```

Rules: one policy **per command** (never `FOR ALL`); always `to authenticated`; wrap `auth.uid()`
in `(select …)`; `WITH CHECK` on writes; index the policy column; never read `user_metadata` in a
policy; split highly-sensitive columns into their own table.

## Payments (entitlement is server-owned)

`public.subscriptions` is **client read-only**. Only a trusted server writes it: a Stripe webhook
**Route Handler** that verifies the `Stripe-Signature` against the raw body, then upserts entitlement
with the service-role client. Never trust the client for entitlement. (Add the `stripe` dep + the
route when you wire payments.)

## Verification (release gates)

- `supabase test db` runs the pgTAP RLS tests in `supabase/tests/database/`.
- `supabase db lint` (Security Advisor) must be clean of ERROR lints — **0007** (policy exists, RLS
  disabled), **0013** (RLS disabled in public), **0015** (RLS references user_metadata).

## Setup (on your machine)

```
pnpm add @supabase/ssr @supabase/supabase-js
# set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (+ SUPABASE_SERVICE_ROLE_KEY) in .env.local
supabase init   # if you don't have a full config.toml
supabase start && supabase db reset && supabase test db
```
