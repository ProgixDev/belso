-- 0004 — a least-privilege role for the web app.
--
-- Until now the app would have connected as `belso`, which is the Postgres
-- image's superuser: the role that can `create database`, read every table, and
-- run `COPY … FROM PROGRAM` — command execution inside the database container.
-- The public storefront needs none of that. It reads the catalogue and inserts
-- into two tables.
--
-- The gap matters because the app is the one part of this system reachable by
-- anyone. A future injection, or a compromise of the app container, currently
-- yields the whole cluster; with this role it yields twenty published listings
-- that are on the website anyway, plus the ability to write an enquiry.
--
-- Migrations, the seed and the backups keep using the owner. They are run by a
-- human over SSH, not by a request from the internet.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'belso_app') then
    -- No password here: a secret does not belong in a file that is committed.
    -- `scripts/vps/belso-app-role.sh` generates one and sets it.
    -- `login` with no password set: authentication fails until one is, so the
    -- role exists and is useless to anyone until deliberately enabled.
    create role belso_app with login;
  end if;
end
$$;

-- Nothing by default, then only what the app actually does.
revoke all on schema public from belso_app;
grant usage on schema public to belso_app;

grant select on
  districts, district_translations,
  properties, property_translations,
  property_media, property_media_alt,
  property_slug_history
to belso_app;

-- The enquiry path. Insert only: the app has no reason to read other people's
-- enquiries back, and no reason to delete any — retention is the nightly job's
-- work, running as the owner.
grant insert on enquiries to belso_app;
grant usage, select on sequence enquiries_id_seq to belso_app;

-- Deliberately no SELECT on `enquiries`: the storefront writes leads and has no
-- business reading anyone else's back. That makes the public-facing role
-- write-only over the personal data it collects, which is the strongest thing
-- available here short of not collecting it.
--
-- **Consequence worth knowing before it surprises someone:** `insert … returning`
-- needs SELECT on the returned column, so the enquiry insert must stay
-- RETURNING-free. Verified against the role: the app's actual statement
-- succeeds, `select count(*) from enquiries` is denied, and adding a `returning
-- id` would fail with "permission denied for table enquiries" — which reads
-- like a broken grant and is in fact this rule working.

-- The throttle counts, so it needs to read its own row and update it. The
-- upsert there does use `returning count`, which is why SELECT is granted.
grant select, insert, update on enquiry_throttle to belso_app;

-- Tables added by later migrations are owned by `belso` and are invisible to
-- `belso_app` unless granted. That is the safe direction: a new table is
-- unreadable until someone decides it should be, rather than readable because
-- nobody thought about it.
