-- payments-stripe — map app users to Stripe customers. Server-owned.
-- The entitlement table (public.subscriptions) already exists from 0004 and is
-- write-protected (no client policy). This adds the customer mapping so the
-- webhook can resolve a Stripe customer/subscription back to a user_id.
--
-- Like subscriptions, this is SELECT-own for clients and written only by trusted
-- server code (the webhook route, using the service_role key which bypasses RLS).

create table public.stripe_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.stripe_customers to authenticated;

-- Clients may read their own mapping; there is intentionally NO insert/update/delete
-- policy, so only the service_role server path can write it.
create policy "stripe_customers: read own" on public.stripe_customers
  for select to authenticated
  using ((select auth.uid()) = user_id);

create index stripe_customers_customer_idx on public.stripe_customers (stripe_customer_id);
