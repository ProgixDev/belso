-- 0004_subscriptions — server-owned entitlement (NEVER trust the client).
-- Clients get RLS SELECT-only; there is no client write policy, so only a trusted
-- server (the Stripe webhook route, running with the service_role key which bypasses
-- RLS) writes entitlement. See docs/architecture/backend.md.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'inactive'
    check (status in ('active', 'inactive', 'grace', 'expired')),
  product_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.subscriptions to authenticated;

create policy "subscriptions: read own" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Gate premium features by joining this table in your feature policies, e.g.:
--   using ( (select auth.uid()) = user_id and exists (
--     select 1 from public.subscriptions s
--     where s.user_id = (select auth.uid()) and s.status = 'active' ) )
