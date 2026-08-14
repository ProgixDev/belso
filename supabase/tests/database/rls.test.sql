-- pgTAP RLS tests. Run with: supabase test db
-- Asserts the security invariants — fails loudly if a future migration disables RLS
-- or opens a client write path on entitlements.

begin;
select plan(4);

select ok(
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'public'),
  'RLS is enabled on all public tables'
);

select policies_are(
  'public', 'notes',
  array['notes: select own', 'notes: insert own', 'notes: update own', 'notes: delete own'],
  'notes has exactly the owner-scoped CRUD policies'
);

select is_empty(
  $$ select p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
     where c.relname = 'subscriptions' and p.polcmd in ('a', 'w', 'd') $$,
  'subscriptions has no client INSERT/UPDATE/DELETE policy'
);

select ok(
  not has_table_privilege('anon', 'public.notes', 'select'),
  'anon cannot select from notes'
);

select * from finish();
rollback;
