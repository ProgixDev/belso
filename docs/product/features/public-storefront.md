# Public storefront

**Status:** live · **Slices:** `src/features/{i18n,properties,enquiries,cinematic-scroll}` · **Routes:** `/[locale]`, `/[locale]/{biens|properties}`, `/[locale]/{biens|properties}/[slug]`, `/[locale]/contact`, `/[locale]/legal/[doc]`
**Spec history:** specs/004-belso-public (shipped 2026-08-17)

## What it does (user terms)

A visitor lands on the cinematic scene, describes the property they want in a search field at its centre, and gets a results page with their own words shown back and a count. Each result carries a photograph, its district, its price in the currency it was listed in with an approximate conversion beside it, and enough facts to judge at a glance. They can reorder by price or by how recently a property was listed.

Opening a property gives the photography as a browsable gallery, the full description, key facts and reference, similar properties, and an enquiry form that already knows which property they are looking at. Sending it confirms on screen, naming the property.

The whole site is in French and English, with the language in the address; switching keeps the visitor on the page they were reading and the choice is remembered. Contact and three legal documents are reachable from the footer everywhere.

## How it works

- **Language lives in the URL.** `src/core/i18n.ts` owns the locale list, the default (`fr`), and the translated segment map — `/fr/biens/…` and `/en/properties/…` are the same route. It sits in `core`, not the slice, because `src/proxy.ts` needs it and middleware may not import a feature.
- **`src/proxy.ts`** detects the locale, redirects bare paths, rewrites the translated segment onto the real directory path, and **composes with** `updateSession` rather than replacing it — replacing it signs the visitor out on every translated URL.
- **`features/properties`** — `types.ts` mirrors the future database shape; `repository.ts` is a `server-only` seam over fixtures that Phase 2 swaps for Supabase by replacing one module; `lib.ts` holds the pure logic (translation fallback, the matcher, sort comparators, similarity scoring) so most acceptance criteria are provable without a browser.
- **`features/enquiries`** — a zod schema, a painted-door Server Action that validates like the real thing and persists nothing, and the form. The action returns error _keys_, never sentences, because it cannot know the page's language.
- **`features/i18n`** — `fr.ts` is the source of truth and `en.ts` is typed against it, so adding a French key fails the build until it is translated. A missing string cannot reach a page.
- **`app`** — two root layouts via route groups (`(storefront)`, `(system)`) so `<html lang>` can name the actual language; a nested `(content)` group carries the header and footer for every page except the home scene, which supplies its own.

## Decisions & gotchas

- **2026-08-17 — A `loading.tsx` anywhere above a route turns its 404 into a soft 200.** The shell streams before `notFound()` throws, so the status is already sent; the page renders correctly and returns 200 to every crawler. The listings skeleton therefore lives in `properties/(index)/`, which does not wrap `[slug]`, and the detail, contact and legal routes ship no `loading.tsx`. If one of them ever needs streaming, put `<Suspense>` _inside_ the page below the `notFound()` decision — never above it. **This contradicts `.claude/rules/app-router.md`**, which mandates `loading.tsx` on every feature route.
- **2026-08-17 — Next strips its own router headers before `proxy` runs.** `rsc`, `next-router-prefetch` and `next-router-segment-prefetch` are absent there, so a prefetch cannot be detected that way. This mattered because the locale switcher sits in every header, so Next prefetches the _other_ language's URL and the proxy counted it as a choice — silently overwriting the visitor's language. The proxy now records a locale only on `sec-fetch-dest: document`, and the switcher writes the cookie itself on click.
- **2026-08-17 — Prices sort on a converted value, not the raw number.** The fixtures mix MAD and EUR; comparing digits ranked a 12.8M MAD villa above a €3.9M estate. `similarityScore` deliberately does _not_ convert — there a stale rate shifts weighting invisibly, while here not converting produces a visibly false order.
- **2026-08-17 — `localizeProperty` lists every field instead of spreading.** A spread carries `translations` onto the object handed to components, and any component holding that map is one `.en` away from bypassing the fallback rule and rendering a blank description.
- **2026-08-17 — `repository.ts` is exported from the slice barrel** despite being `server-only`, because the boundary rule admits one entry point and changing it needs an ADR. Consequence: importing anything from `@/features/properties` into a client component fails the build naming `server-only`, not the barrel.
- **2026-08-17 — Card focus rings live on the card, not the link.** The stretched title link suppresses its own outline (it would draw a box around the title mid-card); the `<article>` rings itself via `has-[a:focus-visible]`. Suppressing without replacing left the entire grid invisible to keyboard focus.
- **2026-08-17 — `fr-MA` groups thousands with `.`**, so prices render `12.000.000 MAD`. A French-from-France buyer may read that as wrong. Pinned by a test; switching to `fr-FR` is a one-line change to `localeTag`.

## Known gaps

- **The home scene is not translated.** Its nav, lede, headings and Contact button are hardcoded English in `cinematic-scroll/data.ts`, so `/fr` shows French search chrome inside an English scene. Its nav also points at in-page anchors and its Contact is a dead `<button>`.
- **Legal copy is placeholder.** The GDPR-expected sections exist and each is marked as unwritten; pages are `noindex` until real text arrives. No owner has been named.
- **Enquiries go nowhere.** Painted door by design (`docs/process/painted-door.md`); the back-office inbox is spec 003. The action is unthrottled, which is harmless while it persists nothing and must be rate-limited before it does not.
- **Content and photography are fixtures.** Twelve Marrakech listings; thirteen stock frames stand in for real photography.

## CUJs covered

- CUJ-01 — land and travel the story, now under a locale segment with the hero search (`e2e/home.spec.ts`)
- CUJ-03 — browse to enquiry (`e2e/properties.spec.ts`, `e2e/enquiry.spec.ts`)
- Supporting: `e2e/i18n.spec.ts` (AC-1), `e2e/a11y.spec.ts` (AC-11)
