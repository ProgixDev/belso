# Plan 009 — Map view for the listings catalogue

- **Spec:** [spec.md](spec.md) — open questions carried, none blocking (see "Provisional answers")
- **Author:** Houssem Ferrani · **Date:** 2026-08-19
- **ADR:** [0009 — MapLibre GL JS + hosted vector tiles](../../docs/architecture/decisions/0009-maplibre-for-the-listings-map.md)

## Approach

A second view on the catalogue route, not a second route: `?view=map` joins `q` and `sort` in the schema the page already validates, so one URL carries the search, the order and the view.

The map is a client island loaded with `next/dynamic` — the repo's first use, and the only thing that keeps a 200 KB engine off the grid view. It renders in two registers on purpose: **clusters as GL layers**, because clustering is a property of the source and has to scale to the 100–500 listings `plan.md` anticipates; **individual points as HTML markers**, because a `<canvas>` can never be focusable or announced, and a real `<button>` per property is the whole keyboard and screen-reader story. It also gets the price pills our own type for free.

The load-bearing decision is about honesty rather than rendering. We have no addresses, so no coordinate is written into the fixtures. Districts gain a real centre, and one named function derives a stable point inside it for any listing without a coordinate of its own. `precision` is computed from which of the two applied, so the "approximate" caveat turns itself off the day the back-office supplies the real thing — no flag to remember, no second screen to build.

## Placement (per `docs/architecture/module-boundaries.md`)

| What                 | Where                                                          | Notes                                                                                                                                      |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Map island           | `src/features/properties/components/property-map.tsx`          | `"use client"`. Imports `../types` and `../districts` **by relative path** — the barrel re-exports `server-only` and would fail the build. |
| Map lifecycle        | `src/features/properties/components/use-property-map.ts`       | Hook/component split, mirroring `use-cinematic-scroll.ts`: one `[]`-dep effect, full teardown.                                             |
| Marker               | `src/features/properties/components/map-marker.tsx`            | A `<button>`; the same component in both marker modes.                                                                                     |
| Approximate location | `src/features/properties/lib.ts`                               | Pure and testable, beside `localizeProperty` which consumes it.                                                                            |
| District centres     | `src/features/properties/districts.ts`                         | Extends the existing record. This is where the deferred boundary geometry will attach.                                                     |
| `view` in the URL    | `src/features/properties/types.ts`                             | `propertyViews` + the schema, same `as const` + `.catch()` convention as `propertySorts`.                                                  |
| Style URLs           | `src/core/env.client.ts`                                       | Public config; a feature may import `core`. Blank-is-unset guard, as for Supabase.                                                         |
| Label bridge         | `src/app/(storefront)/[locale]/_components/property-labels.ts` | `mapLabels(dict)` beside `propertyCardLabels(dict)` — `app` is the only layer that sees both slices.                                       |
| Composition          | `.../(content)/properties/(index)/page.tsx`                    | Stays a thin RSC. Chooses grid or map, passes data and labels down.                                                                        |

**No new slice.** A `src/features/map/` would need `Property`, `DistrictId`, `districts` and the repository, and a feature may not import another feature — the same reason districts live inside the properties slice already.

## Data & state

- **Server data:** `listProperties({ query, sort, locale })`, unchanged. The map receives the same array the grid does, so the two views can never disagree about what matched.
- **URL state:** `view` (`grid` | `map`), validated with `.catch("grid")` — a stale `?view=` is a typo, not a 500 (SEC-INPUT-001). The viewport is deliberately not in the URL.
- **Client state:** the marker mode (`points` | `prices`) and the ground (`map` | `satellite`) are `useState` in the island; the open marker is `useState`. No store — nothing outside the island reads any of it, and `docs/conventions/state.md` puts a feature store fourth.
- **Actions:** none. The map reads.

## Acceptance criteria → verification mapping

| AC   | Proven by                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1 | `e2e/map.spec.ts` — switch view, await `data-map-ready`, assert the URL carries `view=map` and the marker count                                  |
| AC-2 | `e2e/map.spec.ts` — open a marker, assert the popup names the property, follow it to the listing                                                 |
| AC-3 | `e2e/map.spec.ts` — assert a cluster marker with a count at city zoom, and that opening it raises the count of individual markers                |
| AC-4 | `e2e/map.spec.ts` — prices mode shows a formatted price on a marker; satellite swaps the style                                                   |
| AC-5 | `lib.test.ts` — `approximateLocation` determinism and containment; `precision` resolution both ways. `e2e/map.spec.ts` — the caveat is on screen |
| AC-6 | `e2e/map.spec.ts` under `javaScriptEnabled: false` — every listing still listed                                                                  |
| AC-7 | `e2e/a11y.spec.ts` — the existing tab sweep extended to the map view; a reduced-motion context asserts no animated transition                    |
| AC-8 | `e2e/map.spec.ts` — with the style URL blanked, the grid renders and the map says it is unavailable                                              |

## Provisional answers to the carried unknowns

| Unknown                   | Answer used                                                              | Cost if wrong                                                                   |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Publish exact positions?  | No: approximate until a real coordinate exists, then exact automatically | One boolean on the listing if the client wants some kept fuzzy — model is ready |
| Which tile account?       | A development style URL; the variable is the seam                        | None in code; an environment change                                             |
| District vocabulary (B-3) | The ten currently shipped                                                | Adding a district means adding a centre beside its copy                         |

## Risks & unknowns

- **Bundle leakage.** If `next/dynamic` is misconfigured MapLibre lands in the shared chunk and the grid view pays 200 KB for a map nobody asked for. Measured in Phase 4, not assumed.
- **CSP.** There is no `worker-src` directive at all today, so MapLibre's blob worker is blocked the moment the CSP goes enforcing. Fixed in this pass rather than left as a trap.
- **jsdom cannot render WebGL.** No unit test will cover the island; the precedent is `use-cinematic-scroll.ts`, which has none either and is verified entirely in Playwright against a published readiness signal.
- **The a11y tab sweep already walks `/fr/biens`.** Every control the map adds must have a visible focus ring or that existing test fails — which is the correct outcome.

## Overlap check

Active specs touching the same areas: none. 004 is shipped; 005–008 are unwritten.
