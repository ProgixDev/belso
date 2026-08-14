# Tasks 004 — Belso Luxury public storefront

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and never reorders silently. `[P]` marks tasks safe to parallelize. Every task names its files and its done-check.

This spec is large. **Phases 1–3 are each independently shippable** — the site stays green and usable at the end of every phase. Do not start a phase before the previous one's `pnpm verify` is green.

## Phase 0 — setup

- [x] T0.1 Create branch `feat/004-belso-public` · done: `git status` clean on new branch
- [x] T0.2 Scaffold the three slices (files: `src/features/{i18n,properties,enquiries}/index.ts`) · done: `pnpm lint` green, each `index.ts` exports nothing yet
      <!-- Deviation: created by hand rather than via /new-module. The canonical scaffold ships a
              Zustand store + provider + action stub; none of these three slices needs a store (locale is
              URL+cookie, listings are RSC + searchParams, the form uses local state), so the scaffold
              would have added dead code for reviewers to flag. Patterns are still mirrored from
              src/features/task-list/ — index.ts public API, zod types.ts, painted-door actions.ts. -->

## Phase 1 — foundation: tokens, routing, shell (AC-1, AC-10)

- [x] T1.1 Promote the scene palette + Archivo scale into oklch role tokens, light + dark (files: `src/app/globals.css`) · done: no raw hex outside the token block; existing home renders unchanged
      <!-- Palette converted from the scene hexes, not eyeballed. All 20 WCAG pairs pass in both
              themes; `border` and `input` were split because a control boundary owes 3:1 (WCAG 1.4.11)
              and a decorative divider does not. Added `@custom-variant dark` so the `dark:` utilities and
              the tokens switch on the same signal — they were previously media- vs class-based. -->
- [ ] T1.2 [P] Shared primitives: `button`, `input`, `field`, `badge`, `skeleton` (files: `src/components/ui/*.tsx`) · done: each has a colocated test rendering all variants
- [x] T1.3 Rename `src/middleware.ts` → `src/proxy.ts` for the Next 16 convention, **no behaviour change** (files: `src/proxy.ts`) · done: build emits no deprecation warning; `/account` still redirects when signed out
      <!-- Verified: build warning gone; GET /account → 307 → /sign-in?next=%2Faccount. -->
- [x] T1.4 Locale config: locale list, default `fr`, segment map (`biens`↔`properties`, `contact`, `legal`), detection helper (files: `src/core/i18n.ts`, `src/core/i18n.test.ts`) · done: `i18n.test.ts` green incl. segment-map round-trip (**AC-1 unit**)
      <!-- 17 tests. Covers q-value ordering, cookie-beats-header, malformed cookie, and that a
          planned-but-unshipped locale (ar) never resolves. -->

- [ ] T1.5 Locale routing in the proxy: `/` → `/fr`, `Accept-Language` on first visit, cookie persistence, translated-segment rewrite — composing with `updateSession`, not replacing it (files: `src/proxy.ts`) · done: `/`→`/fr`, `/en/properties` and `/fr/biens` both resolve, `/account` unaffected
- [ ] T1.6 Dictionaries + accessor: fr/en UI strings, `getDictionary(locale)`, `formatPrice` via `Intl` (files: `src/features/i18n/{dictionaries,index,lib}.ts`, `lib.test.ts`) · done: `formatPrice` unit test covers MAD/EUR and the `≈` conversion form
- [ ] T1.7 Locale layout + shell: `<html lang dir>`, header with working nav, footer with contact + legal links, locale switcher that stays on the current page (files: `src/app/[locale]/layout.tsx`, `src/app/[locale]/_components/{site-header,site-footer}.tsx`, `src/features/i18n/components/locale-switcher.tsx`) · done: switcher preserves path across locales
- [ ] T1.8 Move the home route under the locale segment (files: `src/app/[locale]/page.tsx`, delete `src/app/page.tsx`) · done: CUJ-01 passes against `/fr`
- [ ] T1.9 `pnpm verify` + `pnpm e2e` green; conventional commit · done: both green

## Phase 2 — properties: index and detail (AC-2, AC-3, AC-4, AC-5, AC-9)

- [ ] T2.1 Domain types mirroring plan.md §4 — property, translation, media, amenity, provisional type/amenity unions (files: `src/features/properties/types.ts`) · done: `pnpm typecheck` green
- [ ] T2.2 Fixtures: ~12 Marrakech listings, fr+en, **deliberately varied** description lengths, 3–15 photos, ≥1 with no English translation, ≥1 sold/under-offer (files: `src/features/properties/fixtures/*.ts`) · done: a fixture assertion test proves the variance the quality bar requires
- [ ] T2.3 Repository seam: `server-only`, `listProperties`/`getPropertyBySlug`/`getSimilar` (files: `src/features/properties/repository.ts`) · done: importing it from a client component fails the build
- [ ] T2.4 [P] `lib.ts`: sort comparators, `resolveTranslation` fallback, similar-property scoring (files: `src/features/properties/lib.ts`, `lib.test.ts`) · done: `lib.test.ts` green (**AC-3, AC-9 unit**)
- [ ] T2.5 Search field on the home scene, submitting to the listings route (files: `src/features/cinematic-scroll/components/*`) · done: submitting navigates with the query in the URL (**AC-2**)
- [ ] T2.6 Listings index: result count, query echoed back, sort control, card grid, **empty state with a way onward**, loading skeleton, error state (files: `src/app/[locale]/properties/{page,loading,error}.tsx`, `src/features/properties/components/{property-card,results-header,sort-control}.tsx`) · done: all four states reachable by hand (**AC-3, AC-4**)
- [ ] T2.7 Listing detail: gallery, key facts, dual-currency price, reference, description, similar properties, fallback-translation note (files: `src/app/[locale]/properties/[slug]/{page,loading,error}.tsx`, `src/features/properties/components/{gallery,key-facts,price}.tsx`) · done: renders for every fixture incl. the untranslated one (**AC-5, AC-9**)
- [ ] T2.8 `not-found` for unknown slugs, in-locale, with a route back (files: `src/app/[locale]/properties/[slug]/not-found.tsx`) · done: unknown slug returns 404 (**AC-8**)
- [ ] T2.9 `pnpm verify` green; conventional commit · done: green

## Phase 3 — enquiries, contact, legal (AC-6, AC-7, AC-10)

- [ ] T3.1 Enquiry action: `"use server"`, zod schema, typed result, **painted-door no-op with the no-op commented** (files: `src/features/enquiries/{actions,types}.ts`, `actions.test.ts`) · done: `actions.test.ts` proves invalid email returns a typed error and no success (**AC-7 unit**)
- [ ] T3.2 Enquiry form: per-field errors in the page's language, input preserved on failure, success naming the property (files: `src/features/enquiries/components/enquiry-form.tsx`) · done: failing submit keeps every other field's value
- [ ] T3.3 Wire the pre-filled form into listing detail, quoting the reference (files: `src/app/[locale]/properties/[slug]/page.tsx`) · done: reference appears without typing (**AC-6**)
- [ ] T3.4 [P] General contact page reusing the same form without a property (files: `src/app/[locale]/contact/{page,loading,error}.tsx`) · done: submits and confirms
- [ ] T3.5 [P] Legal pages: one template, three docs, GDPR-expected headings as marked placeholders (files: `src/app/[locale]/legal/[doc]/page.tsx`, `src/features/i18n/dictionaries/legal.ts`) · done: all three resolve in both locales (**AC-10**)
- [ ] T3.6 `pnpm verify` green; conventional commit · done: green

## Phase 4 — verification

- [ ] T4.1 E2E: `e2e/browse-to-enquiry.spec.ts` — the full CUJ-03 path with `shot()` at each step · done: `pnpm e2e:shots` green (**AC-2, AC-3, AC-5, AC-6**)
- [ ] T4.2 E2E: `e2e/properties-states.spec.ts` — empty results, bad email, unknown slug · done: green (**AC-4, AC-7, AC-8**)
- [ ] T4.3 E2E: `e2e/i18n.spec.ts` — default locale, switch, persistence, translated URLs, fallback note, full nav/footer link crawl · done: green (**AC-1, AC-9, AC-10**)
- [ ] T4.4 E2E: `e2e/a11y.spec.ts` — keyboard tab-through with visible focus, `reducedMotion: 'reduce'` render · done: green (**AC-11**)
- [ ] T4.5 Register CUJ-03 and update CUJ-01's row (files: `docs/product/critical-user-journeys.md`) · done: `pnpm check:docs` green
- [ ] T4.6 Run `/verify-ui` — inspect every screenshot against the ACs and `docs/design/quality-bar.md`; fix what you see · done: no unaddressed visual defect
- [ ] T4.7 `pnpm verify` + `pnpm e2e` green; history clean · done: both green

## Phase 5 — review & ship

- [ ] T5.1 Run `/review`; fix P0/P1 findings · done: no open P0/P1
- [ ] T5.2 Run `/security-review` — the enquiry action is the only untrusted input path · done: no open SEC finding
- [ ] T5.3 Run `/feature-report` → `docs/reports/004-belso-public.md` · done: report exists with screenshots
- [ ] T5.4 Open PR (template filled, spec + report linked) · done: PR open
- [ ] T5.5 After merge: `/update-docs` — feature doc, CUJ table, specs index status → `shipped` · done: `pnpm check:docs` green

## AC coverage (mirror of plan.md — keep ticked in sync)

- [ ] AC-1 → T1.4, T1.5, T4.3 · [ ] AC-2 → T2.5, T4.1 · [ ] AC-3 → T2.4, T2.6, T4.1
- [ ] AC-4 → T2.6, T4.2 · [ ] AC-5 → T2.7, T4.1 · [ ] AC-6 → T3.3, T4.1
- [ ] AC-7 → T3.1, T3.2, T4.2 · [ ] AC-8 → T2.8, T4.2 · [ ] AC-9 → T2.4, T2.7, T4.3
- [ ] AC-10 → T1.7, T3.5, T4.3 · [ ] AC-11 → T4.4
