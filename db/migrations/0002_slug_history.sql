-- 0002 — remember every address a listing has ever had.
--
-- Spec 010, AC-7. Once the client can rename a listing from the back-office,
-- she can change its slug — and every link we published, every crawler's index
-- and every message an agent sent a buyer still points at the old address.
--
-- A 404 there is a lost enquiry, which on this site is the only thing that
-- actually matters. So retiring a slug records it, and `getPropertyBySlug`
-- falls back to this table and redirects.


create table property_slug_history (
  property_id   text not null references properties(id) on delete cascade,
  locale        text not null,
  slug          text not null,
  retired_at    timestamptz not null default now(),

  -- The lookup is "which listing used to live here", so the old address is the
  -- key. A slug can only ever have belonged to one listing in one language —
  -- `property_translations` enforces the same uniqueness for live ones.
  primary key (locale, slug)
);

create index property_slug_history_property_idx
  on property_slug_history (property_id);

-- ---------------------------------------------------------------------------
-- Keep it filled without anyone remembering to.
-- ---------------------------------------------------------------------------
-- A back-office that edits a slug and forgets to write history is the failure
-- this is guarding against, and asking the application to remember is how it
-- gets forgotten. The database observes the change instead.
create function record_retired_slug() returns trigger as $$
begin
  if old.slug is distinct from new.slug then
    insert into property_slug_history (property_id, locale, slug)
    values (old.property_id, old.locale, old.slug)
    -- If this slug was retired before and is being retired again, the later
    -- retirement is the interesting one.
    on conflict (locale, slug) do update
      set property_id = excluded.property_id,
          retired_at  = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger property_translations_slug_history
  after update on property_translations
  for each row execute function record_retired_slug();

