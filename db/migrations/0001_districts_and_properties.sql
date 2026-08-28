-- 0001 — districts, properties, their translations and their media.
--
-- Spec 010. The shape follows `src/features/properties/types.ts` closely on
-- purpose: this is the same domain, written down twice, and the day the two
-- disagree is the day `row.ts` starts producing `undefined` that typechecks.
--
-- Ordering is deliberately NOT expressed here. `sortProperties` orders in
-- TypeScript and stays that way for this spec — AC-1 promises the same order as
-- the fixtures, and SQL resolves ties differently. See plan.md, Risks.


-- ---------------------------------------------------------------------------
-- Districts
-- ---------------------------------------------------------------------------
-- Ids are the ten in `districts.ts`, kept as text rather than a generated key:
-- they are already stable, human-readable, and appear in URLs. A serial id here
-- would buy nothing and make every fixture reference indirect.
create table districts (
  id            text primary key,
  -- City outwards, not alphabetical — the order the index presents them in.
  position      integer not null unique,
  -- The centre a listing without its own coordinates is placed near. Hand
  -- placed to roughly a kilometre and honest about it; see districts.ts.
  center_lat    double precision not null,
  center_lng    double precision not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- District prose is per-locale and a locale may legitimately be missing.
create table district_translations (
  district_id   text not null references districts(id) on delete cascade,
  locale        text not null,
  name          text not null,
  lede          text not null,
  body          text not null,
  primary key (district_id, locale)
);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

-- The commercial state of the listing: is it still for sale.
create type listing_status as enum ('available', 'underOffer', 'sold', 'rented');

-- Whether the listing is visible at all. **A different axis from the above**,
-- and conflating the two would make a sold property invisible and an archived
-- one purchasable. `draft` is being written; `published` is public; `archived`
-- has left the catalogue without being destroyed.
create type publication_state as enum ('draft', 'published', 'archived');

create type listing_kind as enum ('sale', 'rent');

create table properties (
  id            text primary key,
  -- The agency's own reference, quoted in enquiries. Unique because the seed
  -- upserts on it (AC-8) and because two listings sharing one would make every
  -- enquiry ambiguous.
  reference     text not null unique,
  district_id   text not null references districts(id) on delete restrict,

  kind          listing_kind not null,
  type          text not null,
  status        listing_status not null,
  publication   publication_state not null default 'draft',

  -- The asking price in the currency it was **listed** in. Everything else the
  -- site shows is a conversion. numeric, not float: money.
  price         numeric(14, 2) not null,
  currency      text not null,

  bedrooms      integer not null,
  bathrooms     integer not null,
  built_area    integer not null,
  land_area     integer,
  built_year    integer,
  parking       integer not null default 0,

  -- Nullable on purpose, and null on every seeded row. A listing without this
  -- is placed inside its district by `resolveLocation`, and the map says so.
  -- Filling these in is what turns the "approximate" caveat off by itself.
  lat           double precision,
  lng           double precision,

  amenities     text[] not null default '{}',

  -- A date, not a timestamptz. `formatDate` was already bitten once by
  -- treating a date as UTC midnight and printing the day before.
  listed_at     date not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Either both coordinates or neither; half a position is not a position.
  constraint properties_coordinates_complete
    check ((lat is null) = (lng is null)),
  constraint properties_price_positive check (price > 0)
);

-- Every public read filters on this, so it leads the index.
create index properties_publication_district_idx
  on properties (publication, district_id);
create index properties_publication_listed_at_idx
  on properties (publication, listed_at desc);

create table property_translations (
  property_id   text not null references properties(id) on delete cascade,
  locale        text not null,
  -- Per-locale: /fr/biens/villa-vue-atlas vs /en/properties/villa-atlas-view.
  slug          text not null,
  title         text not null,
  description   text not null,
  district      text not null,
  city          text not null,
  primary key (property_id, locale),
  -- Two listings cannot share an address in the same language.
  unique (locale, slug)
);

create table property_media (
  id            text primary key,
  property_id   text not null references properties(id) on delete cascade,
  -- Path under `public/`, or an absolute URL once real photography lands.
  url           text not null,
  width         integer not null,
  height        integer not null,
  -- Ordering within a listing's gallery. Explicit, because a gallery whose
  -- order depends on insertion is a gallery that reshuffles on re-seed.
  position      integer not null,
  unique (property_id, position)
);

-- Alt text is per-locale prose, so it is a table rather than a column.
create table property_media_alt (
  media_id      text not null references property_media(id) on delete cascade,
  locale        text not null,
  alt           text not null,
  primary key (media_id, locale)
);

