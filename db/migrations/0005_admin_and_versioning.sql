-- 0005 — the people who may edit, their sessions, and a version to edit against.
--
-- Spec 011. Until now nothing in this database knew who anybody was: the only
-- writer was a human running `migrate.mjs` over SSH. The back-office adds a
-- second kind of writer — the client, from a browser — and that needs three
-- things the schema does not have: accounts, sessions, and a way for two people
-- editing the same listing to find out rather than overwrite each other.
--
-- ADR-0011 records why sessions are a table here rather than a library's
-- schema, and why passwords are scrypt.


-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Three people at an agency in Marrakech. There is no sign-up route and there
-- will not be one: accounts are created by `scripts/admin-user.mjs`, run over
-- SSH by the owner, the same posture as migrations. A public registration form
-- on a back-office with no email verification is an open door with a hinge.
create table admin_users (
  id             uuid primary key default gen_random_uuid(),

  email          text not null,

  -- scrypt output with its parameters packed alongside, so a future increase in
  -- cost does not invalidate existing rows: each hash is verified with the
  -- parameters it was made with. Never the password, and never reversible.
  password_hash  text not null,

  -- Shown in the back-office so "who published that" has an answer.
  display_name   text not null,

  -- Revocation, without destroying the row. Deleting an account would take its
  -- name off the listings it published; disabling keeps the history and stops
  -- the person, which is what "she has left the agency" actually means.
  disabled_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Case-insensitive, as a functional index rather than `citext`.
--
-- Nobody types their own email consistently, and an agency of three does not
-- need two accounts because somebody capitalised the S in Sofia. `citext` would
-- express this more directly but is an extension, and an extension is a thing
-- that has to be installed on every database this schema is ever restored into
-- — including a developer's scratch copy — to avoid a restore that fails at
-- `create table`.
create unique index admin_users_email_key on admin_users (lower(email));

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
-- The row is keyed by the SHA-256 of the token, never the token.
--
-- The cookie holds 32 random bytes; this holds their digest. So a database dump
-- — a backup on somebody's laptop, a `pg_dump` in a support ticket — is not a
-- set of live cookies, and neither is a `select *` by anyone who reaches the
-- database read-only. The token is high-entropy and random, so a plain hash is
-- enough: there is no dictionary to run against it, which is the only reason
-- passwords need scrypt and this does not.
create table admin_sessions (
  token_sha256   bytea primary key,
  user_id        uuid not null references admin_users(id) on delete cascade,

  created_at     timestamptz not null default now(),
  -- Touched on use, so an idle session can be distinguished from a live one.
  last_seen_at   timestamptz not null default now(),
  -- Absolute, not sliding. A forgotten session on a shared agency machine
  -- expires on its own rather than living as long as somebody keeps browsing.
  expires_at     timestamptz not null
);

-- Sign out everywhere, and the sweep of expired rows.
create index admin_sessions_user_idx on admin_sessions (user_id);
create index admin_sessions_expires_idx on admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Login throttle
-- ---------------------------------------------------------------------------
-- Same shape as `enquiry_throttle` (0003) and deliberately a **separate table**,
-- not a shared one with a "kind" column.
--
-- The grants are the reason. `belso_app` — the role the public storefront holds
-- — must be able to write the enquiry counter, because the contact form is
-- unauthenticated and that is where the counting happens. It must never be able
-- to write this one, where a row it could reset is the difference between a
-- rate-limited login and an unlimited one. One table cannot hold both grants.
--
-- Two axes live here as two different keys, not two columns: by network, so one
-- machine cannot grind through passwords; and by account, so a botnet spread
-- across a thousand addresses still cannot grind through one person's. Either
-- alone leaves the other attack open.
create table admin_login_throttle (
  key_hash       text primary key,
  window_start   timestamptz not null default now(),
  count          integer not null default 0
);

create index admin_login_throttle_window_idx on admin_login_throttle (window_start);

-- ---------------------------------------------------------------------------
-- A version to edit against
-- ---------------------------------------------------------------------------
-- AC-10: two people open the same listing, both save, and the second must be
-- told rather than silently winning.
--
-- An integer, **not `updated_at`**, which was the first design and is wrong for
-- two reasons that only appear in production. `now()` in Postgres is the
-- *transaction's* start time, so two updates inside one transaction produce
-- identical timestamps and compare equal — the check would pass when it should
-- fail. And a timestamptz has to survive a round trip through an HTML form as
-- text, where microseconds are exactly the kind of thing a formatter rounds.
-- An integer has neither problem, and `version = 4` is legible in a bug report.
alter table properties add column version integer not null default 1;

-- The bump is the database's job, not the application's.
--
-- Every write path would otherwise have to remember `version = version + 1`,
-- and the one that forgets does not fail — it makes concurrent editing silently
-- lossy again, in the one code path nobody tests twice.
create function touch_property() returns trigger as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$ language plpgsql;

create trigger properties_touch
  before update on properties
  for each row execute function touch_property();

-- A listing is not just its `properties` row.
--
-- Its title, its description and its photographs live in three other tables,
-- and a version that only moved when the price changed would let two people
-- overwrite each other's prose while the check sat there looking satisfied.
-- These push the change up to the parent, where the version lives.
--
-- `after`, and returning null: the parent update must happen only once the
-- child row is actually written, and an `after` trigger's return value is
-- ignored.
create function touch_parent_property() returns trigger as $$
begin
  update properties set updated_at = now()
   where id = coalesce(new.property_id, old.property_id);
  return null;
end;
$$ language plpgsql;

create trigger property_translations_touch_parent
  after insert or update or delete on property_translations
  for each row execute function touch_parent_property();

create trigger property_media_touch_parent
  after insert or update or delete on property_media
  for each row execute function touch_parent_property();

-- Alt text reaches the parent through its photograph, because that is the only
-- link it has. Included for the same reason as the two above and not because a
-- caption is important: editing only captions is a real edit, and if it did not
-- move the version then two people writing alt text would be back to silently
-- overwriting each other — the exact defect this section exists to remove.
create function touch_parent_property_via_media() returns trigger as $$
begin
  update properties p set updated_at = now()
    from property_media m
   where m.id = coalesce(new.media_id, old.media_id)
     and p.id = m.property_id;
  return null;
end;
$$ language plpgsql;

create trigger property_media_alt_touch_parent
  after insert or update or delete on property_media_alt
  for each row execute function touch_parent_property_via_media();

-- ---------------------------------------------------------------------------
-- Reordering a gallery
-- ---------------------------------------------------------------------------
-- `unique (property_id, position)` from 0001 is correct and, checked per row,
-- makes reordering impossible: dragging the third photograph to the front means
-- something briefly shares a position with something else, and the first UPDATE
-- of the sequence fails.
--
-- Deferrable moves the check to commit, so the gallery has to be consistent
-- when the transaction ends and not at every step inside it. `initially
-- immediate` keeps today's behaviour for everything else — the seed, the tests,
-- any statement that does not ask — and the reorder opts in with
-- `set constraints … deferred`. That is the safe default: the one path that
-- needs the looser rule states so, rather than every path silently getting it.
--
-- The alternative was two passes, writing negative positions first and real
-- ones second. It works, it needs no schema change, and it leaves a table whose
-- positions are briefly nonsense and whose bug reports read like corruption.
alter table property_media
  drop constraint property_media_property_id_position_key;

alter table property_media
  add constraint property_media_property_id_position_key
  unique (property_id, position) deferrable initially immediate;
