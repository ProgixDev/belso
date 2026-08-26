# 0009 — Use MapLibre GL JS with hosted vector tiles for the listings map

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Houssem Ferrani (dev), client (product)

## Context

The client asked for a map of the catalogue modelled on JamesEdition: clustered pins, price pills, a satellite toggle, and a list/map switch. A map was already scoped — `plan.md` §4 reserves `city, district, lat, lng` on the properties table and §7 Phase 3 lists a map on the listing detail — but spec 004 shipped without one, and the omission is recorded in `listing-json-ld.tsx`: _"Geo coordinates are omitted until the map is built — inventing a point for a private residence is not a rounding error."_

Every runtime dependency the app carries today is small and framework-adjacent (twelve, the largest being `motion`). A WebGL map engine is an order of magnitude heavier and brings a tile provider, a browser worker, and a recurring cost with it. `docs/architecture/decisions/README.md` requires an ADR for a dependency with architectural weight; `docs/conventions/styling.md` requires one for any UI dependency outside shadcn/Radix. This is both.

## Decision

Render the listings map with **MapLibre GL JS**, styled from **hosted vector tiles configured by URL** (MapTiler at launch), loaded exclusively through `next/dynamic` so it never reaches the catalogue's grid view.

The provider is addressed as two public style URLs — `NEXT_PUBLIC_MAP_STYLE_URL` and `NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL` — not as an API key in code. Swapping providers, or moving to self-hosted tiles later, is an environment change rather than a code change.

## Alternatives considered

| Option                             | Why not                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapbox GL JS**                   | What the reference itself uses, and the best satellite imagery — but proprietary from v2, billed per load with a card on file, and its style spec is the lock-in. MapLibre is the same engine before that fork. |
| **Leaflet + OSM raster tiles**     | Lighter and keyless, but raster tiles cannot do smooth zoom, rotation or data-driven styling, so the price pills and clustering would be hand-built. OSM's tile policy also discourages commercial use.         |
| **Self-hosted PMTiles on the VPS** | Zero recurring cost and no third-party host, which fits ADR-0006. But satellite imagery is impractical to self-host at any useful resolution, and satellite is in the brief. Kept as the escape hatch below.    |
| **A static map image per listing** | Cheapest and fastest, and enough for a locator on a detail page — but the ask is a searchable map of the whole catalogue, which a picture cannot be.                                                            |
| **Google Maps JS API**             | Familiar to visitors, but a card on file, a heavier licence, and a visual language that is nobody's brand but Google's.                                                                                         |

## Consequences

- **Positive:** open-source engine (BSD-3), no licence risk, and the same data-driven styling the reference relies on. The provider is one environment variable, so the self-hosted PMTiles path stays open without a rewrite. Clustering, satellite and price pills all come from one library rather than three.
- **Negative / accepted trade-offs:** roughly 200 KB gzipped, an order of magnitude more than any current dependency — `next/dynamic` is the only thing keeping it off the grid view, and that has to be verified rather than assumed. Tile loads are free to about 100k a month and metered after; the style URL is public, so the provider key must be domain-restricted on day one or the quota is public too. One more supply-chain surface (SEC-SUPPLY-001).
- **Follow-ups required:**
  - `next.config.ts` gains `worker-src 'self' blob:` — currently there is no `worker-src` at all, so `default-src 'self'` is the fallback and MapLibre's worker would be blocked the moment the CSP goes enforcing. `connect-src` and `img-src` are narrowed from the `https:` wildcard to the tile host at the same time (SEC-NET-002).
  - `NEXT_PUBLIC_MAP_STYLE_URL` and `NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL` are added to `src/core/env.client.ts` and `.env.example`, with the blank-is-unset guard so an unconfigured deploy degrades to the grid instead of a broken frame.
  - `Permissions-Policy: geolocation=()` stays closed. A "locate me" control would need that header reopened and is out of scope.
  - This is the repo's first use of `next/dynamic`; `docs/conventions/react.md` already sanctions it for heavy client-only islands.
