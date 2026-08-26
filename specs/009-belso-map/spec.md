# Spec 009 — Map view for the listings catalogue

- **Status:** active
- **Type:** feature
- **Requested by:** the client · **Owner:** Houssem Ferrani
- **Date:** 2026-08-19
- **Slice · areas touched:** `src/features/properties` (types, lib, districts, components) · `src/core/env.client.ts` · `src/app/(storefront)/[locale]/(content)/properties/(index)` · `src/app/(storefront)/[locale]/_components` · `src/features/i18n/dictionaries` · `next.config.ts`

<!-- Numbered 009, not 005: plan.md §7 reserves 005–008 for the AI search, content, SEO and launch phases. -->

## Problem (the why)

A buyer choosing between the Palmeraie and the medina is choosing between two places before they are choosing between two houses. The catalogue answers "what is for sale" as a grid of twenty cards ordered by price or date; it cannot answer "what is for sale _there_", and neither can a list, at any length.

The client asked for the map JamesEdition has: pins on a real map, grouped where they crowd, showing prices, with a switch back to the list. A map was always intended here — `plan.md` §4 reserves `lat, lng` on the properties table and §7 Phase 3 lists one — but spec 004 shipped without it, deliberately, because inventing a coordinate for a private residence is not a rounding error.

That is the tension this spec resolves: the site has no addresses, and it still has to put twenty properties on a map without pretending to know where they are.

## Desired behavior (the what)

On the catalogue, a visitor can switch from the grid to a map of Marrakech carrying the same listings. Properties appear as points; where several stand close together they are grouped into one marker with a count, which separates when opened. Opening a point shows that property's photograph, price and key facts, and leads to its page.

The visitor can ask to see prices on the points instead of plain markers, and can swap the drawn map for satellite photography. A single control returns them to the list.

Where the exact position of a property is not known, the map says so rather than implying precision. When the back-office begins supplying real coordinates, those listings sharpen on their own and stop carrying the caveat.

## Acceptance criteria

- **AC-1:** Given a visitor on the catalogue, when they switch to the map, then the properties appear as points on a map of Marrakech, and the address in their browser reflects the view they are on so it can be shared or reloaded.
- **AC-2:** Given the map is open, when the visitor opens a point, then they see that property's photograph, its price, and enough facts to judge it, and can reach its page from there.
- **AC-3:** Given several properties stand close together at the current zoom, then they are shown as one marker carrying how many there are, and opening that marker separates them.
- **AC-4:** Given the map is open, when the visitor asks to see prices, then every point shows its asking price; and when they ask for satellite, then the drawn map is replaced by photography of the ground.
- **AC-5:** Given a property whose exact position is not known, then the map states that its location is approximate, and given one whose position is known, then it makes no such claim.
- **AC-6:** Given a visitor whose JavaScript did not run, when they open the map view, then they still get every property as a list, and are told the map needs JavaScript.
- **AC-7:** Given a visitor navigating by keyboard, then every map control and every property point is reachable with focus visible; and given a visitor who has asked their system to reduce motion, then the map changes view without animating between them.
- **AC-8:** Given the map has not been configured, then the catalogue still works, and the map view says the map is unavailable rather than showing a broken frame.

## Out of scope

- **The rentability calculator.** The client marked it _plus tard_ and has not specified the inputs or the yield formula — gross or net, which charges, which occupancy assumption. Each answer changes the number, so none of it can be guessed.
- **District boundaries with hover statistics.** Also _plus tard_, and blocked on the client supplying the data she wants shown (schools, transport, and so on). The district record is where that geometry will attach.
- **A locator map on the listing detail page.** `plan.md` §7 Phase 3 asks for one and it remains unbuilt. Cheap to add once the engine is in, but it is a second surface with its own states and does not belong in the same pass.
- **The map viewport in the address.** Sharing an exact frame is a real feature, but writing every pan into history makes the back button walk through the map — the same reason the gallery keeps its index out of the URL.
- **A "locate me" control.** `Permissions-Policy` disables geolocation site-wide; reopening it is a security decision, not a map feature.
- **Filtering by drawing on the map.** The reference has it. It needs the filter set first, which is spec 005.

## CUJ impact

Registers **CUJ-05 — Find a property on the map** (`e2e/map.spec.ts`, screenshots `3*-*`). Extends CUJ-03 only in that the catalogue gains a second view; the browse-to-enquiry journey is unchanged.

## Resolved during planning

- **Engine and tiles:** MapLibre GL JS with hosted vector tiles addressed by style URL — ADR-0009. Mapbox, Leaflet, self-hosted PMTiles and a static image were all considered and rejected there.
- **Placement:** a view on the existing catalogue route rather than a page of its own. The header holds four items before the language switcher falls off a 390px screen, and a second address for the same twenty listings splits the filters.
- **Pin accuracy:** every listing without a real coordinate is placed at a stable point inside its own district and labelled approximate. This is also what agencies at this level do on purpose — the exact gate of a private villa is not published.
- **Coordinates are derived, not written into the fixtures.** Twenty hand-written latitudes would be twenty fabrications shaped like survey data. The derivation lives in one named function instead.

## Open questions

- [ ] Does the client want exact positions published once the back-office supplies them, or should some listings stay deliberately approximate? The model supports both; the answer is about privacy, not code. (Ties to the back-office field set, `plan.md` Phase 2.)
- [ ] Which tile provider account will the client hold, and on which domain will the key be restricted? Until that exists the map runs against a development style URL.
- [ ] B-3 remains open: the district vocabulary is provisional, and the map draws its approximate points from it.
