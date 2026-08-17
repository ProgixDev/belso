# Plan 004 — Belso Luxury public storefront

- **Spec:** [spec.md](spec.md) (all open questions resolved: **no** — B-3, B-4, B-7 and legal copy are carried as accepted assumptions; see _Provisional answers_)
- **Author:** Claude (agent) · **Date:** 2026-08-14

## Approach

Three new slices — `i18n`, `properties`, `enquiries` — sitting on a token-and-shell foundation, with every page reading through a **repository seam** rather than touching data directly. Fixtures implement that seam today; Phase 2 swaps in Supabase queries by replacing one module, not by editing pages. The deliberate cost taken up front is the URL layer: translated route segments (`/fr/biens/…` vs `/en/properties/…`) plus per-locale slugs mean a segment map and a rewrite before a single page ships, but it buys out the redirect debt that changing URLs after launch would create against a "référencement +++" priority.

**No ADR required.** i18n is hand-rolled (no new dependency) and no boundary rule changes. Locale configuration lives in `src/core/i18n.ts` — not in the slice — because `src/middleware.ts` needs it and middleware cannot import a feature.

## Placement (per `docs/architecture/module-boundaries.md`)

| What             | Where                                                                                              | Notes                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Locale config    | `src/core/i18n.ts`                                                                                 | Locale list, default, segment map, slug↔locale resolution. Pure data — importable everywhere.  |
| Locale routing   | `src/middleware.ts` (→ `proxy.ts`)                                                                 | Detect, redirect, rewrite translated segments. **Composes with** existing `updateSession`.     |
| i18n slice       | `src/features/i18n/`                                                                               | Dictionaries (fr, en), `useTranslations`, locale switcher UI, `formatPrice` via `Intl`.        |
| Properties slice | `src/features/properties/`                                                                         | `types.ts` (mirrors plan.md §4), `repository.ts` (`server-only`), `fixtures/`, cards, gallery. |
| Enquiries slice  | `src/features/enquiries/`                                                                          | Form components, `actions.ts` (zod, painted door).                                             |
| Routes           | `src/app/[locale]/{page,properties/page,properties/[slug]/page,contact/page,legal/[doc]/page}.tsx` | Thin RSC composition only. Each ships `loading.tsx` + `error.tsx`.                             |
| Shell            | `src/app/[locale]/layout.tsx`                                                                      | `<html lang dir>`, header, footer.                                                             |
| Design tokens    | `src/app/globals.css`                                                                              | Promote scene palette + Archivo scale to oklch role tokens.                                    |
| Shared additions | `src/components/ui/`                                                                               | Only primitives with ≥2 consumers: `button`, `input`, `field`, `badge`, `skeleton`.            |

Header/footer live in `src/app/[locale]/` (composition, used by every route) rather than a slice — they are chrome, not a capability. `cinematic-scroll` gains only the search field and moves under `[locale]`; its internals are otherwise untouched.

## Data & state

- **Server data:** `properties/repository.ts` marked `server-only`, exposing `listProperties({query, sort, locale})`, `getPropertyBySlug(slug, locale)`, `getSimilar(id, locale)`. Backed by typed fixtures (~12 listings, fr+en, varied description lengths and photo counts). Fetched in RSC; no client fetching.
- **Client state:** none for listings — query and sort live in `searchParams` per `.claude/rules/app-router.md`. Gallery index is local component state. Locale is URL + cookie.
- **Actions:** `enquiries/actions.ts` — `"use server"`, zod-parses every field, returns a typed result object. **Painted door:** on valid input it returns success and persists nothing, with the no-op stated in a comment so nobody mistakes it for working.
- **Translation fallback:** `resolveTranslation(row, locale)` returns `{ text, isFallback }`; the UI renders the note from `isFallback` rather than guessing at an empty string.

## Acceptance criteria → verification mapping

| AC    | Proven by                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | unit: `src/core/i18n.test.ts` (detection, default, segment map round-trip) · e2e: `e2e/i18n.spec.ts` steps 1–4 (persistence) |
| AC-2  | e2e: `e2e/browse-to-enquiry.spec.ts` steps 1–2 (`shot('01-home')`, `shot('02-results')`)                                     |
| AC-3  | unit: `properties/lib.test.ts` (sort comparators) · e2e: `browse-to-enquiry.spec.ts` step 3                                  |
| AC-4  | e2e: `e2e/properties-states.spec.ts` "empty search" (`shot('empty-results')`)                                                |
| AC-5  | e2e: `browse-to-enquiry.spec.ts` step 4 (`shot('03-detail')`, gallery advance)                                               |
| AC-6  | e2e: `browse-to-enquiry.spec.ts` steps 5–6 (`shot('04-enquiry')`, `shot('05-confirmation')`)                                 |
| AC-7  | unit: `enquiries/actions.test.ts` (invalid email → typed error, no success) · e2e: `properties-states.spec.ts` "bad email"   |
| AC-8  | e2e: `properties-states.spec.ts` "unknown slug → not-found"                                                                  |
| AC-9  | unit: `properties/lib.test.ts` (`resolveTranslation` fallback flag) · e2e: `e2e/i18n.spec.ts` step 5                         |
| AC-10 | e2e: `e2e/i18n.spec.ts` step 6 — crawl every header and footer link in both locales, assert 200 and no dead anchor           |
| AC-11 | e2e: `e2e/a11y.spec.ts` — keyboard tab-through with visible focus assertion; `reducedMotion: 'reduce'` context + screenshot  |

## Provisional answers to the carried unknowns

| Unknown        | Provisional answer used                                                                                                     | Cost if wrong                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| B-3 vocabulary | 8 property types + 14 amenities, from plan.md §4's examples, as a typed union in `core/i18n`-adjacent `properties/types.ts` | Renaming a union + fixture edits — cheap    |
| B-7 logo/type  | Existing Archivo scale + scene palette, promoted as named role tokens                                                       | Token values change, component code doesn't |
| B-4 FX rule    | Fixed rate table in fixtures, always rendered with `≈` and the original alongside                                           | Swap the rate source — one module           |
| Legal copy     | Structured placeholder sections with GDPR-expected headings                                                                 | Text replacement only                       |

## Risks & unknowns

- **Size.** Three slices and five page types is well beyond a normal spec — realistically several sessions. De-risked by task phasing: Phase 1 (tokens + routing + shell) is independently shippable and leaves the current home working; each later phase adds one page type.
- **Middleware composition.** Locale redirect/rewrite must wrap, not replace, `updateSession`. Getting the order wrong breaks auth silently. De-risked by unit-testing the segment map separately and asserting `/account` still round-trips in `e2e/i18n.spec.ts`.
- **Next 16 deprecation.** The build already warns that `middleware` is deprecated in favour of `proxy`. Migrating while also adding locale logic is two changes at once — T1.3 does the rename first, alone, and verifies before locale logic lands.
- **RTL debt is not paid here.** fr and en are both LTR, so logical properties are unverifiable in this spec. New pages use them from the start, but the existing `cinematic-scroll` CSS keeps its physical properties — recorded, deliberately deferred to the Arabic phase.
- **Quality bar vs fixtures.** `docs/design/quality-bar.md` rejects single-length data. Fixtures must vary description length, photo count (3–15) and missing-translation state, or the review will (correctly) fail.
- **Skeleton routes.** `/examples/tasks`, `/account`, `/sign-in` stay outside the locale tree and keep working. CUJ-02 must not break. Cleanup is a Phase 2/7 decision, not this spec's.

## Overlap check

Active specs touching the same areas: **none.** 001-task-list is `shipped`; no other spec is `active`. This spec touches the `cinematic-scroll` slice, which no active spec owns. No sequencing constraint.
