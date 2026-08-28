-- 0003 — enquiries, and the throttle that keeps the table from being a target.
--
-- Spec 010, AC-4. Until now the contact form was a painted door: it validated
-- exactly like the real thing and persisted nothing, so every lead the site
-- produced was lost. This is where they land.
--
-- **Everything in `enquiries` is personal data.** A name, an email, a phone
-- number and free prose, from visitors who are mostly in the EU. Two things
-- follow and are built in rather than promised: it can be deleted, and it
-- expires on its own.


create table enquiries (
  id            bigserial primary key,

  -- The listing this is about, if any — a contact-page enquiry has none. Set
  -- null rather than cascade: losing the listing must not destroy the lead,
  -- which is worth more than the row it points at.
  property_id   text references properties(id) on delete set null,
  -- Kept flat as well, because the agency quotes the reference and it must
  -- survive the listing being archived or its reference being corrected.
  reference     text,
  subject       text,

  name          text not null,
  email         text not null,
  phone         text,
  message       text not null,

  -- Read state for the back-office, so the client can tell new from handled.
  handled_at    timestamptz,

  created_at    timestamptz not null default now(),

  -- Retention. 24 months, the assumption recorded in spec 010, expressed as a
  -- column rather than as a rule someone has to remember: the nightly job
  -- deletes whatever is past its own date. Changing the period changes one
  -- default, and rows already written keep the promise made when they were
  -- collected — which is the point of storing it per row.
  expires_at    timestamptz not null default now() + interval '24 months'
);

create index enquiries_created_idx on enquiries (created_at desc);
create index enquiries_expires_idx on enquiries (expires_at);
create index enquiries_property_idx on enquiries (property_id);

-- ---------------------------------------------------------------------------
-- The throttle
-- ---------------------------------------------------------------------------
-- This is the site's only unauthenticated write path. Without a limit, one
-- script fills the table, the disk, and the client's inbox.
--
-- In Postgres rather than in memory because the app may run as more than one
-- process, and a per-process counter silently multiplies the real limit by the
-- number of instances.
--
-- The key is hashed, not stored: the raw value is an IP address, which is
-- itself personal data, and this table has no business holding one.
create table enquiry_throttle (
  key_hash      text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0
);

create index enquiry_throttle_window_idx on enquiry_throttle (window_start);

