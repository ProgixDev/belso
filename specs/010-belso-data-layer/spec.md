# Spec 010 — Listings come from a database, not from fixtures

- **Status:** shipped 2026-08-28 — [PR #3](https://github.com/ProgixDev/belso/pull/3) · [report](../../docs/reports/010-belso-data-layer.md)
- **Type:** feature
- **Requested by / owner:** Houssem Ferrani
- **Date:** 2026-08-28
- **Slice / areas touched:** `src/features/properties` (repository, types), `src/features/enquiries`, `src/core/env.ts`, routes `/[locale]/biens`, `/[locale]/quartiers`, `/[locale]/contact` <!-- used for conflict detection across active specs -->

## Problem (the why)

Every listing on the site is a hand-written fixture in the repository. The client cannot add,
edit or remove a property without a developer and a deploy, which makes the site a brochure we
maintain for her rather than a catalogue she runs. She has asked for a back-office, and a
back-office with nowhere to write is not a back-office.

Two things follow from that and are worth naming now. Visitor enquiries currently go nowhere —
the contact form is a painted door, so every lead the site generates is lost, which is the one
thing the site exists to produce. And the twenty fixtures are stand-ins: the real catalogue
arrives with real photographs, real addresses and real prices, and it has to land somewhere.

This spec builds the place it lands. ADR-0008 settled where that place lives.

## Desired behavior (the what)

For a visitor, **nothing changes.** The catalogue, the neighbourhood pages, the map and the
listing pages look and behave exactly as they do today. That is the point: this is the floor
being replaced under a finished room, and the only honest evidence of success is that the room
is unchanged.

Behind that, the listings, neighbourhoods and their photographs are stored in a database on our
own server, seeded from today's twenty fixtures so nothing is lost in the move. Every listing
carries a state — being written, published, or archived — and only published listings are ever
visible to the public. A listing being drafted is invisible until the client says otherwise; an
archived one (sold, withdrawn) leaves the catalogue without being destroyed.

When a visitor sends an enquiry, it is recorded and can be read later, rather than vanishing.
Enquiries are personal data, so they are kept only as long as they are useful and can be deleted
on request.

If the database is unreachable, the site says so plainly on the affected page rather than
showing an empty catalogue that reads as "this agency has nothing for sale."

And the data can be got back. A restore is rehearsed and proven, not assumed.

## Acceptance criteria

- **AC-1:** Given the site is served from the database, when a visitor browses the catalogue, a
  neighbourhood, the map and a listing page, then they see the same twenty properties, in the
  same order, with the same prices, photographs and translations as the fixtures produced.
- **AC-2:** Given a listing is in the draft state, when any visitor requests the catalogue, a
  neighbourhood page, the map, the sitemap or that listing's own URL directly, then it is absent
  from the listings and its URL returns not-found — in both languages.
- **AC-3:** Given a listing is archived, when a visitor browses the catalogue, then it does not
  appear; and when an administrator looks in the database, then the record and its history are
  still there.
- **AC-4:** Given a visitor completes the enquiry form, when they submit it, then the enquiry is
  stored with the listing it refers to (if any) and the visitor is told it was received; and when
  the same visitor submits repeatedly, then the excess is refused rather than recorded.
- **AC-5:** Given the database is unreachable, when a visitor opens the catalogue, then they are
  shown a page that says the listings cannot be loaded right now — not an empty catalogue, and
  not a stack trace. The rest of the site that does not need listings still works.
- **AC-6:** Given a backup taken by the routine, when it is restored into an empty database, then
  every listing, translation, photograph reference and enquiry is present and the site runs
  against it unmodified. This is proven by performing the restore, not by inspecting the file.
- **AC-7:** Given a listing's slug changes, when a visitor follows an old published URL, then they
  are redirected to the current one rather than meeting a 404 — links we have already published
  must not rot.
- **AC-8:** Given the seed is run twice, when it completes, then the catalogue contains twenty
  listings, not forty.

## Out of scope

- **The back-office itself** — administrator sign-in, the listing editor, image upload. That is
  spec 011 and it is the reason this one exists; this spec ends at a database the next one can
  write to. Seeding and any early edits happen through migrations or SQL.
- **Image uploading and resizing.** The schema records where a photograph lives; putting new ones
  there is spec 011. Today's images stay as repository assets.
- **Removing Supabase from the codebase.** ADR-0008 lists it as a follow-up; deleting
  `src/lib/supabase/`, `src/features/auth/` and `supabase/` is a separate, purely subtractive
  change that should not ride along with a data-layer swap and confuse its diff.
- **Deploying the app to the VPS.** The app can keep running where it runs today and reach the
  database over the network; moving the app is its own change with its own failure modes.
- **A public API.** Nothing outside the app reads this database.
- **Rentability calculator and district boundary data** — still deferred by the client pending
  her figures, unchanged from spec 009.

## CUJ impact

- No new CUJ. This spec must leave **CUJ-01, CUJ-03, CUJ-04 and CUJ-05 passing byte-for-byte
  unchanged** — they are the regression harness for the swap, and that is precisely their value
  here. AC-2 and AC-5 add cases to `e2e/properties.spec.ts` rather than a new journey.

## Assumptions pending confirmation

These were raised with the owner, who chose to proceed rather than answer. They are written down
as decisions so the build is not blocked, and each is cheap to overturn while the catalogue is
still twenty seeded rows. None of them changes the shape of the schema.

- **Enquiry retention: 24 months**, then deletion. A single configured value, applied by the
  same nightly job that takes the dump, so changing the period is changing one number. The
  privacy copy must state it before real enquiries are collected — and that copy still has no
  owner, the same gap flagged in spec 004.
- **Archived listings are not shown to the public.** Records are retained, so deciding later to
  show sold properties as proof of trade is a read filter, not a migration.
- **Snapshots are assumed on until someone confirms otherwise.** This is panel-side and invisible
  from the machine, so it cannot be verified or tested from here.

## Open questions

- [ ] **Are Hostinger snapshots actually enabled and scheduled?** Owner action, in the Hostinger
      panel. Everything else here can be built and proven without it, but if they are off then
      the nightly dump built by this spec is the _only_ backup and it lives on the same disk as
      the database — which is not a backup at all. Blocking before real data is entered, not
      before this spec is implemented.

## Notes on the accepted backup trade-off

The chosen strategy is **Hostinger VM snapshots**, accepted knowingly over off-box object
storage. Two consequences follow and are accepted: the backup lives at the same provider as the
thing it protects, and a snapshot restores the whole machine — there is no way to recover a
single listing the client deleted by mistake without rolling back everything, including her n8n.

One addition closes the second gap at no cost and no new vendor: a nightly `pg_dump` written to
local disk, which the snapshot then sweeps up. It takes seconds at this size, and it turns
"restore the whole VM to last night" into "restore one table" — the failure that actually
happens in practice. AC-6 tests the dump path, because it is the one a human will reach for.
