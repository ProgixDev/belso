# Tasks 009 — Map view for the listings catalogue

Work top to bottom, tick as you commit, never reorder. `[P]` marks a task that is parallel-safe with its neighbours. Every task names its files and its done-check. Each phase is independently shippable and ends `pnpm verify` green.

Findings, deviations and anything learned go in `## Implementation notes` at the bottom, keyed by task id — not as nested comments inside the list items, which makes Prettier non-idempotent and breaks `pnpm verify`.

## Phase 0 — decide

- [x] T0.1 ADR-0009: MapLibre + hosted vector tiles, with the alternatives table (files: docs/architecture/decisions/0009-maplibre-for-the-listings-map.md) · done: file exists, linked from plan.md
- [x] T0.2 Fix the ADR index drift — 0007 was never listed — and add 0009 (files: docs/architecture/decisions/README.md) · done: both rows present
- [x] T0.3 Spec, plan and tasks (files: specs/009-belso-map/{spec,plan,tasks}.md) · done: `pnpm check:docs` green
- [x] T0.4 Register the spec in the index (files: specs/README.md) · done: row present, status `active`

## Phase 1 — data: where a listing is (AC-5)

- [x] T1.1 District centres: `center: { lat, lng }` on `District`, one per district, sources recorded in a comment (files: src/features/properties/districts.ts) · done: typecheck green, ten centres
- [x] T1.2 `coordinates?: { lat, lng }` on `Property` — optional, absent from every fixture, the shape the Phase-2 `lat, lng` columns map onto (files: src/features/properties/types.ts) · done: typecheck green with fixtures untouched
- [x] T1.3 `approximateLocation(reference, center)`: deterministic scatter inside ~600 m, seeded by a stable hash — no `Math.random`, or the point moves between server and client (files: src/features/properties/lib.ts) · done: unit test green
- [x] T1.4 `location` on `LocalizedProperty`, resolved in `localizeProperty` — the field-by-field object is the silent-failure point (files: src/features/properties/lib.ts, types.ts) · done: `lib.test.ts` green (**AC-5 unit**)
- [x] T1.5 [P] Tests: determinism across calls, containment inside the district, `precision` both ways, every fixture resolves to a point (files: src/features/properties/lib.test.ts, districts.test.ts) · done: `pnpm test` green
- [x] T1.6 `pnpm verify` green · commit `feat(properties): give every listing a point on the map`

## Phase 2 — engine: the island (AC-1, AC-2, AC-3)

- [x] T2.1 `maplibre-gl` dependency; confirm `pnpm audit` clean of highs (files: package.json, pnpm-lock.yaml) · done: SEC-SUPPLY-001 satisfied
- [x] T2.2 Style URLs in client env with the blank-is-unset guard and a `mapConfigured` flag (files: src/core/env.client.ts, .env.example) · done: `pnpm secrets:check` green, build green with the vars unset
- [x] T2.3 CSP: add `worker-src 'self' blob:` and `child-src 'self' blob:`; narrow `connect-src` and `img-src` from the `https:` wildcard to the tile host (files: next.config.ts) · done: headers inspected in a running response (**SEC-NET-002**)
- [x] T2.4 `use-property-map.ts`: one `[]`-dep effect — create, source, layers, listeners, `map.remove()` in cleanup; `data-map-ready` on first `load` (files: src/features/properties/components/use-property-map.ts) · done: attribute observed in a browser
- [x] T2.5 `map-marker.tsx`: a `<button>`, both modes, focus ring, accessible name naming the property (files: src/features/properties/components/map-marker.tsx) · done: reachable by keyboard
- [x] T2.6 `property-map.tsx`: clusters as GL layers, leaves as HTML markers, popup rendering `PropertyCard variant="quiet"` (files: src/features/properties/components/property-map.tsx, src/features/properties/index.ts) · done: pins render in the right districts (**AC-1, AC-2, AC-3**)
- [x] T2.7 `pnpm verify` green · commit `feat(properties): the map island`

## Phase 3 — chrome: the view and its states (AC-4, AC-6, AC-7, AC-8)

- [x] T3.1 `propertyViews` + `view` in the search-params schema, `.catch("grid")` (files: src/features/properties/types.ts, index.ts) · done: `?view=nonsense` renders the grid, no 500
- [x] T3.2 The toggle: a real `<a href>` carrying `q` and `sort` across, in both directions (files: src/features/properties/components/results-header.tsx or a sibling) · done: works with JS disabled
- [x] T3.3 Compose the view in the page, map island behind `next/dynamic` with a skeleton matching `loading.tsx` (files: .../properties/(index)/page.tsx, loading.tsx) · done: grid view ships no map JS (**AC-1**)
- [x] T3.4 Mode controls — points/prices, map/satellite (files: src/features/properties/components/property-map.tsx) · done: both switch (**AC-4**)
- [x] T3.5 `<noscript>` fallback listing every property, and the unconfigured fallback (files: .../properties/(index)/page.tsx) · done: both observed (**AC-6, AC-8**)
- [x] T3.6 Keyboard path and reduced motion — `matchMedia` read imperatively, no animated fly-to (files: use-property-map.ts, map-marker.tsx) · done: `e2e/a11y.spec.ts` green (**AC-7**)
- [x] T3.7 Copy in both dictionaries and the `mapLabels` bridge (files: src/features/i18n/dictionaries/{fr,en}.ts, src/app/(storefront)/[locale]/\_components/property-labels.ts) · done: typography check green
- [x] T3.8 `pnpm verify` green · commit `feat(properties): the map view, its modes and its fallbacks`

## Phase 4 — verification

- [x] T4.1 `e2e/map.spec.ts` covering AC-1 to AC-6 and AC-8, with `shot()` evidence (files: e2e/map.spec.ts) · done: `CI=true pnpm e2e` green
- [x] T4.2 Extend the a11y sweep to the map view (files: e2e/a11y.spec.ts) · done: green (**AC-7**)
- [x] T4.3 Screenshots into `artifacts/screenshots/009-belso-map/` and **looked at**, against the three reference frames · done: inspected
- [x] T4.4 Bundle check: the grid view's JS must not move (files: —) · done: grid 990 KB, map 1,932 KB — the difference is MapLibre and the grid pays none of it
- [ ] T4.5 Lighthouse on `/fr/biens` in both views — LCP ≤ 2.5 s, CLS ≤ 0.1, INP < 200 ms · done: numbers recorded in the notes

## Phase 5 — review & ship

- [ ] T5.1 `/review` — P0/P1 fixed, P2 ticketed or declined in the PR
- [ ] T5.2 `/security-review` — a new dependency and a header change each trigger it
- [ ] T5.3 `docs/reports/009-belso-map.md` via `/feature-report`
- [ ] T5.4 Register CUJ-05 (files: docs/product/critical-user-journeys.md) · done: row present
- [ ] T5.5 `/update-docs` — feature doc, INDEX, spec marked shipped

## Implementation notes

_T0.1–T0.3_ — Numbered 009 rather than 005: `plan.md` §7 reserves 005–008 for the AI search, content, SEO and launch phases. The ADR is 0009 for the matching reason — `plan.md` Phase 1 reserves 0008 for self-hosted Supabase, which is unwritten. Fixing the missing 0007 row was drive-by drift, not part of this feature.

_T2.4 — the afternoon this cost._ MapLibre v6 starts its worker as an ES module and **Turbopack does not emit that chunk correctly**. The failure is silent: the style loads, `sourcedata` fires, no tile is ever parsed, `load` never fires, and the map sits on its loading state behind a working WebGL canvas with nothing in the console. CSP was ruled out by running the page with `bypassCSP` (no change), WebGL by three headless GL back-ends (all reported WebGL 2.0). `scripts/sync-map-worker.mjs` serves the worker from our own origin and `setWorkerUrl` points at it; a same-origin worker also means the CSP needs `worker-src 'self'` rather than `blob:`, which is tighter than what this started with.

_T2.6 — two layout bugs found by measuring rather than looking._ `h-[calc(100dvh-13rem)]` emits invalid CSS: `calc` needs whitespace around the minus, and Tailwind wants underscores for it. The declaration was dropped, the box collapsed to zero height, and the canvas had nothing to draw into. Then `absolute inset-0` was defeated by MapLibre's own stylesheet, which sets `.maplibregl-map { position: relative }` and is imported after Tailwind — sizing the container directly sidesteps the cascade.

_T3.3 — the markers were derived, not stored._ Storing them meant subscribing to `idle` from an effect that only runs once the map is loaded, by which time the map had already gone idle: the listener waited for a second one that never came and the map rendered with no pins. They are computed during render against a move counter instead.

_T4.1 — AC-6 is asserted against the response, not the DOM._ Playwright's `javaScriptEnabled: false` disables script execution without flipping the scripting flag Chrome styles with, so `<noscript>` keeps `display: none`; measured, its bounding box is null and the cards inside count zero. A real browser renders them. The test asserts the bytes we send contain the fallback list, which is the thing that matters.
