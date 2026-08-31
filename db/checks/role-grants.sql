-- What each role may do, expressed as the escalations that must fail.
--
-- ADR-0010 says the grant list *is* the specification of what each half of the
-- app can do, "checkable in psql rather than inferred from code". This is that
-- check, run by `src/core/role-grants.db.test.ts` so it is not a claim in a
-- comment that quietly stops being true.
--
-- The failure it exists to catch is not a bad grant written on purpose. It is
-- migration 0009, two months from now, adding a table and reflexively granting
-- `all on all tables in schema public` because that is what the internet says —
-- which would hand the public storefront every password hash in one line, with
-- no test anywhere going red.
--
-- Assertions run under `set local role`, which exercises the privilege system
-- without a password needing to exist for either role. Everything happens
-- inside a transaction that rolls back, so the rename below leaves no trace.
begin;

create or replace function assert_refused(label text, stmt text) returns void as $$
begin
  execute stmt;
  raise exception 'ESCALATION — % succeeded and must not have', label;
exception
  when insufficient_privilege then
    raise notice '  refused (correct): %', label;
end;
$$ language plpgsql;

create or replace function assert_allowed(label text, stmt text) returns void as $$
begin
  execute stmt;
  raise notice '  allowed (correct): %', label;
exception
  when insufficient_privilege then
    raise exception 'MISSING GRANT — % was refused and must not have been', label;
end;
$$ language plpgsql;

do $$
declare target text;
begin
  select id into target from properties order by id limit 1;

  raise notice 'as belso_editor —';
  set local role belso_editor;

  perform assert_allowed('read a draft listing',
    'select count(*) from properties where publication = ''draft''');
  perform assert_allowed('update a listing',
    format('update properties set price = price where id = %L', target));
  perform assert_allowed('rename a listing (writes slug history via the 0002 trigger)',
    format('update property_translations set slug = slug || ''-x'' where property_id = %L and locale = ''fr''', target));
  perform assert_allowed('read the slug history it just wrote',
    'select count(*) from property_slug_history');
  perform assert_allowed('read an account to sign somebody in',
    'select count(*) from admin_users');
  perform assert_allowed('count the login throttle',
    'select count(*) from admin_login_throttle');

  perform assert_refused('delete a listing (archiving retains — AC-4)',
    format('delete from properties where id = %L', target));
  perform assert_refused('read enquiries (spec 012, not yet)',
    'select count(*) from enquiries');
  perform assert_refused('write an enquiry',
    'insert into enquiries (name, email, message) values (''a'', ''a@b.c'', ''m'')');
  perform assert_refused('touch the public contact throttle',
    'select count(*) from enquiry_throttle');
  perform assert_refused('mint itself an account',
    'insert into admin_users (email, password_hash, display_name) values (''x@y.z'', ''h'', ''X'')');
  perform assert_refused('clear the login throttle to get unlimited attempts',
    'delete from admin_login_throttle');
  perform assert_refused('create a table',
    'create table escalation_check (id int)');

  reset role;

  raise notice 'as belso_app —';
  set local role belso_app;

  perform assert_allowed('read published listings, as before',
    'select count(*) from properties where publication = ''published''');
  perform assert_refused('read password hashes',
    'select count(*) from admin_users');
  perform assert_refused('read sessions',
    'select count(*) from admin_sessions');
  perform assert_refused('write a listing',
    format('update properties set price = price where id = %L', target));
  perform assert_refused('reset the login throttle',
    'delete from admin_login_throttle');

  reset role;
  raise notice 'OK: every grant and every refusal is as 0006 describes';
end
$$;

rollback;
