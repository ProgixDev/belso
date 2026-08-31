# Spec 011 — The client publishes a listing without a developer

- **Status:** active
- **Type:** feature
- **Requested by / owner:** Houssem Ferrani
- **Date:** 2026-08-29
- **Slice / areas touched:** `src/features/admin` (new), `src/features/properties` (write paths), `src/core/db.ts`, `src/core/session.ts` (new), `src/proxy.ts`, routes `/admin/*` <!-- used for conflict detection across active specs -->

## Problem (the why)

Spec 010 put the catalogue in a database and then left it unreachable: the only ways in are a
migration, a seed script, or SQL over an SSH tunnel. The client still cannot add a property
without a developer, which is the thing she asked for and the reason that spec existed.

The enquiries have the same shape of problem and are handled separately. They are stored and
nobody is told they arrived; the contact page promises a reply within 24 hours and the only
mechanism behind it is somebody remembering to run a query. That is
**[spec 012](../012-belso-inbox/spec.md)**, split off because the notification needs a mail
provider nobody has chosen — and holding the editor hostage to that choice would leave the client
unable to add a property for the sake of a feature about reading messages.

## Desired behavior (the what)

The client signs in with her own email and password and sees her catalogue: every listing,
whatever its state, most recently changed first.

She can write a new listing, or open one she wrote before. A listing is drafted privately for as
long as she likes — she can leave it half-finished, come back tomorrow, and nothing she has not
finished is ever visible on the site. When it is ready she publishes it, and it appears. When a
property sells or is withdrawn she archives it, and it leaves the catalogue without being
destroyed.

**She writes in French, and that is enough to publish.** English is offered on the same form and
is never required: a listing published with French alone appears on the English site in French,
carrying the "untranslated" note the site already renders. She can come back and add English at
any time, and the note disappears by itself when she does.

This is the site working as it was built to. Spec 004 made that fallback deliberate, and one
listing in the catalogue has never had English. The alternative — refusing to publish without a
translation — would either hold a finished property off the site because nobody had translated
it yet, or produce hurried English that reads worse than the honest note.

The editor has to make the state visible, though: she should be able to see at a glance which
listings are French-only, or she will not know what is waiting for a translator.

She uploads photographs by dragging in whatever the photographer sent, at full size. The site
takes care of producing the sizes it needs. She orders them, and she writes what each one shows —
in French, with English optional as everywhere else — because a visitor using a screen reader
deserves better than a filename. This is the field most likely to be skipped, and the one the
site has already been burned by: every stock alt text was once written from the file name, and
a bedroom was announced as the palm grove until somebody looked.

Everything she does is hers alone: signed out, none of it is reachable — and that means the
addresses she uses _and_ the actions behind them, which are separately reachable and separately
have to refuse.

## Acceptance criteria

- **AC-1:** Given the client is signed out, when she requests any back-office address directly,
  then she is sent to sign in and no listing data appears in the response. And given she posts
  directly to any back-office action without signing in, then it refuses and writes nothing — an
  action is reachable without the page it lives on, so the page being guarded is not the same
  claim.
- **AC-2:** Given she is signed in, when she creates a listing and leaves it incomplete, then it
  is saved, it is visible to her, and it is absent from the public catalogue, its own public URL,
  the neighbourhood pages and the sitemap.
- **AC-3:** Given a draft complete in French and empty in English, when she publishes it, then it
  appears on the French site in French and on the English site in French with the untranslated
  note. Given a draft missing a required French field, when she publishes it, then publishing is
  refused and the missing fields are named.
- **AC-3b:** Given a published French-only listing, when she later adds its English, then the
  English site shows the English and the untranslated note is gone — without republishing, and
  without the French page changing.
- **AC-4:** Given a published listing, when she archives it, then it leaves the public catalogue
  and its record, translations and photographs remain.
- **AC-5:** Given she renames a published listing, when a visitor follows the address the listing
  had before, then they arrive at the listing rather than a not-found page.
- **AC-6:** Given she uploads a photograph at full camera size, when the upload finishes, then
  the listing shows it, the site serves a version sized for the page rather than the original,
  and the original is still on disk.
- **AC-9:** Given someone tries a wrong password repeatedly, then the attempts are limited, and
  the response does not reveal whether the email exists.
- **AC-10:** Given two people edit the same listing, when the second saves, then they are told the
  listing changed underneath them rather than silently overwriting the first.

## Out of scope

- **Managing neighbourhoods.** The ten districts and their editorial prose stay in the
  repository; they are content we write, not inventory she runs.
- **Anything a second staff member needs that one does not** — roles, permissions, per-user
  audit trails. Accounts are per person so that revoking one is possible, but everyone signed in
  can do everything.
- **Rich text.** Descriptions stay plain paragraphs, as the fixtures are. A formatting toolbar is
  a design decision the site has not made.
- **Reporting, analytics, dashboards.** She needs to run her catalogue, not measure it.
- **Replying to enquiries in the back-office.** She replies from her own mail client, where her
  signature and her history already are.
- **Deleting listings.** Archive is the reversible answer, and a delete button beside twenty
  years of inventory is a bad idea before it is a useful one.
- **The rentability calculator and district boundary data** — still deferred pending the client's
  figures, unchanged since spec 009.

## CUJ impact

- Registers **CUJ-06 — Publish a listing**: sign in → create → write it in French → upload
  photographs → publish → see it on the public site, and on the English site with the
  untranslated note.
- Must leave CUJ-01, 03, 04 and 05 unchanged. The public site is not the subject of this spec and
  should not move.

## Assumptions carried in

- **Sign-in is email and password**, sessions in Postgres. No mail provider is needed to log in,
  which matters because the mail provider is a new dependency and sign-in must not depend on it.
  Password reset is by hand until there is a reason for more.
- **Photographs are resized once, at upload.** Doing it per request would put image processing on
  two shared cores on every uncached view — the slow-site failure ADR-0008 already names.

## Open questions

- [x] ~~English required to publish?~~ **Resolved: French only.** The first answer was "both
      required", and it was reversed once the conflict surfaced — spec 004's fallback exists
      precisely for this, and one listing has never had English. Requiring a translation would
      have meant either holding finished properties off the site or shipping hurried English.
      English stays optional and can be added at any time (AC-3b).
- [ ] **The privacy notice still has no owner** (carried from spec 010). The back-office makes the
      enquiry data routinely read by a person, which strengthens rather than weakens the case that
      the notice must exist before a production database does.
- [ ] **Enquiry retention** is assumed at 24 months from collection; CNIL guidance for prospect
      data is three years from last contact. Also carried from spec 010.
