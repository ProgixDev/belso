# Spec 004 — Belso Luxury public storefront

- **Status:** shipped 2026-08-17 — [PR #1](https://github.com/ProgixDev/BESTO/pull/1) · living doc: [docs/product/features/public-storefront.md](../../docs/product/features/public-storefront.md)
- **Type:** feature
- **Requested by / owner:** Houssem Ferrani
- **Date:** 2026-08-14
- **Slice / areas touched:** `src/features/i18n`, `src/features/properties`, `src/features/enquiries`, `src/features/cinematic-scroll` (adapted), `src/components/ui`, `src/app/globals.css` (design tokens); routes `/[locale]`, `/[locale]/properties`, `/[locale]/properties/[slug]`, `/[locale]/contact`, `/[locale]/legal/{privacy,cookies,terms}`

<!-- Numbered 004, not 002, to preserve the phase→spec mapping in plan.md §7 (002 = foundation, 003 = back-office). -->

## Problem (the why)

Belso Luxury has a hero page and nothing behind it. Today `/` renders a cinematic scroll whose own navigation points at Projects, Location and Contact — links that go nowhere — so a visitor who wants to see a property, or reach the manager, has no path forward. The agency sells properties above 500 000 € and is judged on first impression, so a beautiful entrance opening onto dead links is worse than no site. plan.md Phase 3 defines this storefront; the frontend half of Phase 1 (tokens, language routing) has to come with it or every page built now gets rewritten later.

## Desired behavior (the what)

A visitor arrives, sees the Belso scene resolve, and finds a single search field at its centre. They describe what they want in their own words, submit, and land on a results page that shows their words back to them with a count and a grid of matching properties. Each result shows a photo, its district, its price in the currency it was listed in with an approximate conversion alongside, and enough key facts to judge it at a glance. They can reorder by price or by how recently it was listed.

Opening a property gives them a gallery of its photography, the full description, its key facts and reference, and a short row of similar properties. Beneath it is an enquiry form that already knows which property they are looking at. Sending it confirms on screen, naming the property.

The whole site is available in French and English. The language is visible in the address, switching keeps them on the page they were reading, and their choice is remembered. Every page is reachable and readable in both. Contact and the legal pages are reachable from the footer everywhere.

Throughout, the site behaves when things go wrong: a search that matches nothing says so and offers a way onward, a property that does not exist gives a proper not-found, a half-filled form explains itself without discarding what was typed, and a property not yet translated shows its French text with an honest note rather than a blank.

## Acceptance criteria

- **AC-1:** Given a first-time visitor opens the site root, when they have expressed no language preference, then they land on the French site with the language visible in the address; choosing English keeps them on the same page and that choice is still in effect on their next visit.
- **AC-2:** Given a visitor on the home page, when they type a description into the central search field and submit, then they arrive at the results page with their own words shown back to them and a count of what matched.
- **AC-3:** Given results exist, then each one shows a photograph, its district and city, its price in the currency it was listed in with an approximate converted value alongside, and its bedroom count and area; and the visitor can reorder the set by price and by most recently listed.
- **AC-4:** Given a search matches no property, then the page says so in plain language and offers at least one way onward (clear the search, or browse everything) — never a bare empty grid.
- **AC-5:** Given a visitor opens a property, then they see its photography as a browsable gallery, its description, its key facts, its reference, its price with converted value, and a set of similar properties.
- **AC-6:** Given a visitor uses the enquiry form on a property, then the form already quotes that property's reference without them typing it, and on submitting valid details they get an on-screen confirmation naming the property.
- **AC-7:** Given a visitor submits an enquiry with a missing or malformed email, then the problem is explained next to the offending field in the language they are reading, everything else they typed is still there, and no confirmation is shown.
- **AC-8:** Given a visitor opens a property address that does not exist, then they get a not-found page in their language with a way back to the properties.
- **AC-9:** Given a property has no English text, when it is viewed in English, then the French text is shown together with a visible note that it has not been translated yet — never an empty field.
- **AC-10:** Given any page in either language, then contact and the three legal pages are reachable from the footer, and every navigation item in the header resolves to a real page.
- **AC-11:** Given a visitor navigating by keyboard, then focus is always visible and every interactive element is reachable; and given a visitor who has asked their system to reduce motion, then the scene and gallery present without the parallax and reveal animations.

## Out of scope

- **Back-office / admin UI of any kind** — that is Phase 2 (`003`).
- **Any database.** No Supabase, no self-hosting, no ADR-0008. Content comes from fixtures; B-1 (VPS audit) is unresolved and this spec must not depend on it.
- **AI extraction and the 3-nearest fallback ranking** — Phase 4. The search field accepts a sentence and matches it plainly; empty results say "nothing matched" rather than offering the three closest.
- **Real enquiry delivery.** Forms validate and confirm but nothing is stored or emailed (painted door, `docs/process/painted-door.md`). The back-office inbox is the specified destination and arrives in Phase 2.
- **Arabic, Italian and Dutch.** Structure must not block them; content and RTL verification are later.
- **Real legal copy** — structure and placement only.
- **Live exchange rates and a currency switcher** — Phase 5. Conversion uses a fixed fixture rate, displayed as approximate.
- **Real photography and real listing content** — Phase 5. Fixtures stand in.

## CUJ impact

- **Registers CUJ-03 — Browse to enquiry:** open the site → search from the home page → open a result → view the gallery and price → send an enquiry → see confirmation.
- **Extends CUJ-01:** the home page gains the central search field and now lives under a language segment.

## Resolved during planning

- **URL structure:** translated route segment _and_ translated slug, per plan.md §6 — `/fr/biens/villa-vue-atlas`, `/en/properties/villa-atlas-view`. Settled now because changing URLs after launch costs redirects against a stated SEO priority.
- **i18n mechanism:** hand-rolled typed dictionaries with native `Intl` for number, date and currency formatting. No new dependency, so no ADR.

## Open questions

Carried as accepted assumptions — the owner chose to proceed rather than wait. Each has a provisional answer in `plan.md`. None blocks building; the first three block final sign-off.

- [ ] **B-3** — the exhaustive property-type and amenity vocabulary. Fixtures use a provisional set; the listing UI can't be final until this is fixed.
- [ ] **B-7** — logo and final typography. Tokens are promoted from the existing scene palette and Archivo scale as a deliberate placeholder.
- [ ] **B-4** — exchange-rate rule, which decides whether the approximate conversion is trustworthy enough to show at launch.
- [ ] Who supplies the legal copy, and by when?
- [ ] `docs/product/overview.md` is still the skeleton placeholder — the product's own PRD should be written (`/write-prd`) so future agents ground in something better than this spec.
