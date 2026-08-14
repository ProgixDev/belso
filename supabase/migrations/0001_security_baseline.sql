-- 0001_security_baseline — deny-by-default posture for the Data API.
--
-- The browser ships a PUBLIC anon key, so Row-Level Security (not key secrecy) is
-- the only real boundary. The #1 real-world Supabase breach is a table reachable by
-- anon/authenticated with RLS disabled (e.g. CVE-2025-48757). This migration makes
-- that mistake structurally hard. See docs/security/checklist.md + docs/architecture/backend.md.

-- 1) Remove default/blanket privileges from the API roles. Access becomes opt-in.
alter default privileges in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
revoke select, insert, update, delete on all tables in schema public
  from anon, authenticated;

-- 2) Private schema for SECURITY DEFINER helpers; never API-exposed.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- 3) Auto-enable RLS on every newly created public table (belt-and-suspenders).
create or replace function private.enable_rls_on_new_tables()
  returns event_trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security;', obj.object_identity);
  end loop;
end;
$$;

drop event trigger if exists trg_enable_rls_on_new_tables;
create event trigger trg_enable_rls_on_new_tables
  on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function private.enable_rls_on_new_tables();
