# Tasks 004 — Belso Luxury public storefront

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and never reorders silently. `[P]` marks tasks safe to parallelize. Every task names its files and its done-check.

This spec is large. **Phases 1–3 are each independently shippable** — the site stays green and usable at the end of every phase. Do not start a phase before the previous one's `pnpm verify` is green.

Findings and deviations are recorded in [Implementation notes](#implementation-notes) at the bottom, keyed by task. Keep them there rather than inline: nested HTML comments inside list items make Prettier non-idempotent, which breaks `pnpm verify`.

## Phase 0 — setup

- [x] T0.1 Create branch `feat/004-belso-public` · done: `git status` clean on new branch
- [x] T0.2 Scaffold the three slices (files: `src/features/{i18n,properties,enquiries}/index.ts`) · done: `pnpm lint` green — see note

## Phase 1 — foundation: tokens, routing, shell (AC-1, AC-10)

- [x] T1.1 Promote the scene palette + Archivo scale into oklch role tokens, light + dark (files: `src/app/globals.css`) · done: no raw hex outside the token block; existing home renders unchanged — see note
- [x] T1.2 [P] Shared primitives: `button`, `input`, `field`, `badge`, `skeleton` (files: `src/components/ui/*.tsx`) · done: each has a colocated test rendering all variants — see note
- [x] T1.3 Rename `src/middleware.ts` → `src/proxy.ts` for the Next 16 convention, **no behaviour change** (files: `src/proxy.ts`) · done: build emits no deprecation warning; `/account` still redirects when signed out
- [x] T1.4 Locale config: locale list, default `fr`, segment map (`biens`↔`properties`, `contact`, `legal`), detection helper (files: `src/core/i18n.ts`, `src/core/i18n.test.ts`) · done: `i18n.test.ts` green incl. segment-map round-trip (**AC-1 unit**)
- [x] T1.5 Locale routing in the proxy: `/` → `/fr`, `Accept-Language` on first visit, cookie persistence, translated-segment rewrite — composing with `updateSession`, not replacing it (files: `src/proxy.ts`) · done: `/`→`/fr` and `/account` unaffected — see note
- [x] **T1.5a** Proxy unit tests — the segment rewrite and the auth-cookie composition are currently proven only by manual request checks and (later) the Phase 4 e2e (files: `src/proxy.test.ts`) · done: 18 tests green — see note
- [x] T1.6 Dictionaries + accessor: fr/en UI strings, `getDictionary(locale)` (files: `src/features/i18n/{dictionaries,index}.ts`) · done: both locales typed identically — see note
- [ ] T1.7 Locale shell: header with working nav, footer with contact + legal links (files: `src/app/[locale]/_components/{site-header,site-footer}.tsx`) · **moved to the head of Phase 2 — see note**
- [x] T1.7b Locale switcher that stays on the current page (files: `src/features/i18n/components/locale-switcher.tsx`) · done: built on the `switchLocalePath` helper, which is unit-tested
- [x] **T1.7a** `<html lang>` / `dir` per locale — **blocks AC-1 sign-off**, see note · done: `/fr` serves `lang="fr-MA"`, `/en` `lang="en-GB"`, `/sign-in` `lang="en"` — see note
- [x] T1.8 Move the home route under the locale segment (files: `src/app/[locale]/page.tsx`, delete `src/app/page.tsx`) · done: CUJ-01 passes against `/fr` — see note
- [x] T1.9 `pnpm verify` + `pnpm e2e` green; conventional commit · done: both green

## Phase 2 — properties: index and detail (AC-2, AC-3, AC-4, AC-5, AC-9)

- [x] T2.1 Domain types mirroring plan.md §4 — property, translation, media, amenity, provisional type/amenity unions (files: `src/features/properties/types.ts`) · done: `pnpm typecheck` green
- [x] T2.2 Fixtures: ~12 Marrakech listings, fr+en, **deliberately varied** description lengths, 3–15 photos, ≥1 with no English translation, ≥1 sold/under-offer (files: `src/features/properties/fixtures/*.ts`) · done: a fixture assertion test proves the variance the quality bar requires
- [x] T2.3 Repository seam: `server-only`, `listProperties`/`getPropertyBySlug`/`getSimilar` (files: `src/features/properties/repository.ts`) · done: importing it from a client component fails the build
- [x] T2.4 [P] `lib.ts`: sort comparators, `resolveTranslation` fallback, similar-property scoring (files: `src/features/properties/lib.ts`, `lib.test.ts`) · done: `lib.test.ts` green (**AC-3, AC-9 unit**)
- [x] T2.5 Search field on the home scene, submitting to the listings route (files: `src/features/cinematic-scroll/components/*`) · done: submitting navigates with the query in the URL (**AC-2**)
- [x] T2.6 Listings index: result count, query echoed back, sort control, card grid, **empty state with a way onward**, loading skeleton, error state (files: `src/app/[locale]/properties/{page,loading,error}.tsx`, `src/features/properties/components/{property-card,results-header,sort-control}.tsx`) · done: all four states reachable by hand (**AC-3, AC-4**)
- [x] T2.7 Listing detail: gallery, key facts, dual-currency price, reference, description, similar properties, fallback-translation note (files: `src/app/[locale]/properties/[slug]/{page,loading,error}.tsx`, `src/features/properties/components/{gallery,key-facts,price}.tsx`) · done: renders for every fixture incl. the untranslated one (**AC-5, AC-9**)
- [x] T2.8 `not-found` for unknown slugs, in-locale, with a route back (files: `src/app/[locale]/properties/[slug]/not-found.tsx`) · done: unknown slug returns 404 (**AC-8**)
- [x] T2.9 `pnpm verify` green; conventional commit · done: green

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
- [x] T4.5 Register CUJ-03 and update CUJ-01's row (files: `docs/product/critical-user-journeys.md`) · done: `pnpm check:docs` green
- [ ] T4.6 Run `/verify-ui` — inspect every screenshot against the ACs and `docs/design/quality-bar.md`; fix what you see · done: no unaddressed visual defect
- [ ] T4.7 `pnpm verify` + `pnpm e2e` green; history clean · done: both green

## Phase 5 — review & ship

- [ ] T5.1 Run `/review`; fix P0/P1 findings · done: no open P0/P1
- [ ] T5.2 Run `/security-review` — the enquiry action is the only untrusted input path · done: no open SEC finding
- [ ] T5.3 Run `/feature-report` → `docs/reports/004-belso-public.md` · done: report exists with screenshots
- [ ] T5.4 Open PR (template filled, spec + report linked) · done: PR open
- [ ] T5.5 After merge: `/update-docs` — feature doc, CUJ table, specs index status → `shipped` · done: `pnpm check:docs` green

## Implementation notes

**T0.2 — slices scaffolded by hand, not via `/new-module`.** The canonical scaffold ships a Zustand store, provider and action stub. None of these three slices needs a store: locale is URL + cookie, listings are RSC + `searchParams`, the form uses local state. Running it would have added dead code for reviewers to flag. Patterns are still mirrored from `src/features/task-list/` — `index.ts` public API, zod `types.ts`, painted-door `actions.ts`.

**T1.1 — palette converted, not eyeballed.** Scene hexes were converted to oklch programmatically. All 20 foreground/background pairs clear WCAG AA in both themes. Two departures from the shadcn defaults: `border` and `input` are separate values, because a control boundary owes 3:1 under WCAG 1.4.11 while a decorative divider does not (sharing one token put inputs at 1.31:1); and `@custom-variant dark` was added because the `dark:` utilities resolved via `prefers-color-scheme` while the tokens keyed off `.dark`, which could land light text on light surfaces.

**T1.5 — composition, not replacement.** Auth cookies from `updateSession` are copied onto the rewritten response; replacing it would sign a visitor out on every translated URL. A file-extension guard keeps `/robots.txt`, `/sitemap.xml` and the manifest out of the locale tree — without it they redirect to `/fr/robots.txt` and 404, which the matcher's asset exclusions do not cover. Verified by request: `/` → 307 `/fr`; `/fr`, `/en`, `/examples/tasks`, `/robots.txt` → 200; `/account` → 307 `/sign-in?next=%2Faccount`.

**T1.6 — partial.** Formatting is done and tested (`src/lib/format.ts`, `src/core/currency.ts`, 8 tests); the dictionaries themselves are not written. Placement is corrected from `plan.md`: formatting went to `shared` and rates to `core`, because the properties slice needs both and features may not import each other. Dictionaries will reach feature components as props from `app`. Finding: our French locale is `fr-MA`, whose CLDR grouping separator is `.` — prices render `12.000.000 MAD`, not `12 000 000`. A French-from-France buyer may read that as wrong. Pinned by a test; raised with B-7. Switching to `fr-FR` is a one-line change in `core/i18n` `localeTag`.

**T1.7a — fixed by splitting the root layout in two.** The old root hardcoded `lang="en"` and could not see the locale, because `[locale]/layout.tsx` nested inside it. Every route now sits in a route group with its own root: `(storefront)/[locale]/layout.tsx` reads the segment and renders `<html lang dir>`, `(system)/layout.tsx` covers the unlocalised routes. `src/app/layout.tsx` is gone — Next accepts a group whose root layout is nested under `[locale]`, because no route in that group resolves without passing through it. Verified by request: `/fr` → `lang="fr-MA"`, `/en` → `lang="en-GB"`, `/sign-in` and `/examples/tasks` → `lang="en"`. The wrapper `<div dir>` is gone with it; `dir` belongs on `<html>`.

Three things fell out of the split that are worth knowing:

- **`lang` carries the region** (`fr-MA`, not `fr`), reusing `localeTag`. That is the same tag `Intl` formats with, so the document cannot claim one language while its prices are grouped by another.
- **Fonts moved to `src/app/_shell/root-shell.tsx`**, which both roots import. `next/font` dedupes per call site, so instantiating them in two layouts would have shipped two copies of each face.
- **The `(system)` group is now `noindex`.** Splitting the shared metadata forced the question, and a sign-in form and an account screen have nothing to offer a search engine. This is a deliberate behaviour change, not a carry-over. Storefront metadata is unchanged apart from per-locale `og:locale` and `hreflang` alternates; the locale-root `canonical` is coarse and **every Phase 2 page must set its own**, or the whole storefront canonicalises to `/fr`.

**T1.5a — 18 proxy tests, `@vitest-environment node`.** `updateSession` is mocked; the point is that the proxy _composes with_ whatever it returns. The two that matter are the ones covering the silent failures: refreshed auth cookies surviving a translated-URL rewrite, and a protected-route redirect outranking the locale work. Note the environment directive — `NextRequest` needs real `Request`/`Response` globals, which the project's default jsdom environment does not provide.

**T1.8 — pulled forward, out of order.** T1.5 activated the locale redirect while no `/[locale]` route existed, so `/` → `/fr` → 404 and the site was broken between the two tasks. The ordering in this file was wrong: T1.5 and T1.8 have to land together.

**T1.2 — most primitives already existed.** `button`, `input`, `card`, `empty-state` and `skeleton` were already in `src/components/ui` and already token-driven, so they needed nothing. Added `field` and `badge`. `Field` is the one that matters: it owns the `htmlFor` / `aria-invalid` / `aria-describedby` plumbing that AC-7 depends on and that is invisible when it is missing — a sighted user sees a red message, a screen-reader user gets silence.

**Harness bug found and fixed while writing those tests.** `vitest.setup.ts` only imported jest-dom, and the project runs with `globals: false`, so Testing Library's auto-cleanup was never registered. Every rendered tree stayed in `document.body` and `screen` queries matched elements from earlier tests — which presents as a component bug that does not exist. Fixed centrally with `afterEach(cleanup)` rather than per-file, since it would have bitten every future component test. All pre-existing tests still pass.

**T1.6 — dictionaries done.** `fr.ts` is the source of truth and `en.ts` is typed as `Dictionary`, so adding a French key fails the build until it is translated. A missing string cannot reach a page.

**T1.7 — deliberately re-sequenced to the head of Phase 2.** Two reasons, both discovered while starting it. First, AC-10 requires every header and footer link to resolve; the properties, contact and legal pages do not exist until Phases 2–3, so a shell built now ships guaranteed dead links and an AC that cannot pass. Second, the home scene supplies its own header, whose nav items are staggered in by the splash via `--in-n1`…`--in-n5`; adding a shared header above it would double the navigation, and removing the scene's own would break the intro. The shell therefore belongs with the first content page that needs it, not before.

**Gotcha for whoever picks this up.** Running `pnpm build` while `pnpm dev` is live corrupts the shared `.next` chunks. The symptom is both CUJs failing with intact SSR HTML but dead client JS, which looks exactly like a real regression. Clear `.next` and restart rather than chasing it.

**T2.3 — `server-only` guards the module, not the import.** The done-check ("importing it from a client component fails the build") passes, but only once the client module is actually _reachable from a route_. A first probe — a `"use client"` component importing `repository.ts` but rendered by nothing — built clean, because Turbopack never pulled it into a client graph. Whoever re-checks this guard must wire the probe into a real page, or they will conclude the seam is protected when it is not. Proven failing with the probe as a route: `'server-only' cannot be imported from a Client Component module`.

**T2.3 — `repository.ts` is not re-exported from `index.ts`.** Routing it through the slice barrel would drag `server-only` into every client component that imports a card from this slice. Server pages import the deep path directly; the barrel carries types and pure helpers only.

**T2.4 — the matcher must be able to return nothing.** Stopwords are the load-bearing part. Without them "villa **avec** vue" matches every listing whose description contains "avec" — all of them — and AC-4's empty state becomes unreachable, which would leave an acceptance criterion that no test could ever fail. Tokens under three characters go too, which is what quietly drops "8", "et" and "12" out of "entre 8 et 12 M MAD" without the matcher needing to know it was a budget. Sort comparators all tie-break on reference, otherwise equal-priced listings reshuffle between renders and the grid looks broken.

**T2.4 — `localizeProperty` lists every field instead of spreading.** Verbose on purpose: a spread carries `translations` onto the object handed to components, and any component holding that map is one `.en` away from bypassing the fallback rule and rendering a blank description. A test asserts the property is absent.

**T2.2 — fixture variance is asserted, not just intended.** `fixtures/properties.test.ts` fails if someone tidies the data into uniformity — description lengths must span an order of magnitude, photo counts must reach both 3 and 15, and at least one listing must have no English and one must be sold. The quality bar rejects UI proven only against even data, and the failure is silent: the grid looks perfect right up until real copy arrives. Two of these assertions caught the fixtures on the first run, which is the point.

**T2.2 — thirteen stock frames stand in for photography.** Long galleries repeat frames. Real photography is Phase 5; each entry still carries its own id and per-locale alt text, so nothing about the gallery's keying or announcements is faked.

**T2.8 — a `loading.tsx` anywhere above a route silently turns its 404 into a soft 200.** This cost an hour and is the single most reusable thing learned in Phase 2. `loading.tsx` wraps everything beneath it in Suspense; the shell then streams with a 200 status _before_ the page throws `notFound()`, and the status can never be corrected. The page still renders the right not-found UI, so it looks completely fine — while returning 200 to every crawler. On a project whose brief says "référencement +++", that is a bug worth more than the loading skeleton.

Proven both directions, in a production build, not just dev: with an ancestor `loading.tsx` an unknown slug returns 200; without it, 404. The isolation that found it: a bare `notFound()` page returned 404 until a `loading.tsx` was dropped into its parent, at which point the same page returned 200.

The resolution is structural. The listings page keeps its skeleton by living in a `properties/(index)/` route group, which does not wrap the sibling `[slug]` segment; `[slug]` ships **no** `loading.tsx`. If the detail page ever gets slow enough to want streaming, the Suspense boundary goes _inside_ the page, below the `notFound()` decision — never back above it. This tension returns the moment listings come from Supabase rather than fixtures, so the constraint is written into the page itself as a comment.

**T2.6 — deep feature imports are not available, even for `server-only` modules.** The first cut imported `@/features/properties/repository` directly, reasoning that routing a `server-only` module through the slice barrel would drag it into any client component importing that barrel. ESLint rejected it, and the rule is right: `docs/architecture/module-boundaries.md` admits exactly one entry point and says changing it needs an ADR. Everything now goes through `index.ts`. The consequence is real but acceptable: importing _anything_ from the properties barrel into a client component fails the build on `server-only`, and the error names `server-only` rather than the barrel, so the cause is not obvious. That trade is documented at the top of `index.ts`.

**T2.6 — sorting by price was wrong across currencies, and the tests agreed with it.** `priceDesc` put a 12 800 000 MAD villa (about €1.2M) above a €3 900 000 estate, because the comparator subtracted raw numbers. Both existing sort tests passed, because they asserted the output was ordered by `price` — the same wrong premise. Found by reading the actual rendered order, not by a failing test. Comparators now convert to one currency first; the two tests were rewritten to assert the converted ordering, and a regression test pins the specific MAD-vs-EUR pair. Note this deliberately leans on the provisional rate table (B-4) — the opposite choice of `similarityScore`, which refuses to convert, because there a stale rate shifts weighting invisibly while here not converting produces a visibly false sequence.

**T2.5 — the home scene is still hardcoded English.** The search field is localised and submits to the translated route, but the scene around it is not: its nav (`Home`, `About`, `Projects`, `Amenities`, `Location`), its lede, its `Contact` button and every heading are literals in `cinematic-scroll/data.ts`. So `/fr` currently shows French search chrome inside an English scene. This predates the spec and is outside T2.5, but it stands against "the whole site is available in French and English" and should be its own task before sign-off. The scene's own nav also points at in-page anchors and its `Contact` is a dead `<button>` — AC-10 requires those to resolve, which is Phase 3 work.

**T1.7 — deliberately left unticked.** The header, footer and `PageShell` are built and every link in them resolves, which is what let Phase 2 ship. The task as written also asks for contact and legal links, and those routes do not exist until T3.4/T3.5 — adding them now would ship guaranteed dead links and an AC-10 that cannot pass. `_components/navigation.ts` is the single list both header and footer read; Phase 3 adds its entries there and ticks this.

**Verification note.** `pnpm e2e` against the dev server is flaky under parallel workers — Turbopack compiles each route on first request and assertions time out, with different tests failing between runs. Run it the way CI does (`CI=true pnpm e2e`, which builds and serves the production output, one worker) before believing a failure. Two rounds of "failures" in Phase 2 were this, not the app.

**A screenshot caught what the assertions did not.** CUJ-01 failed looking for a French submit label. The page was correct and the test was wrong: Playwright's browser announces `en-US`, so `/` resolves to `/en` and the button reads "Search". Nothing in the DOM assertions said so — the failure screenshot did, immediately. The test now asserts the redirect target explicitly rather than assuming it. The same pass caught the detail page labelling its type row "En bref" (a section heading) instead of "Type".
