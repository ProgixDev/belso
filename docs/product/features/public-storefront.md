# Public storefront

**Status:** live · **Slices:** `src/features/{i18n,properties,enquiries,cinematic-scroll}` · **Routes:** `/[locale]`, `/[locale]/{biens|properties}`, `/[locale]/{biens|properties}/[slug]`, `/[locale]/{a-propos|about}`, `/[locale]/contact`, `/[locale]/legal/[doc]`
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
- **`features/cinematic-scroll`** — two beats, hero then about sheet, over a 2400px runway. Everything the scene says arrives as a `CinematicCopy` prop, because the slice may not reach the i18n slice.

## Decisions & gotchas

- **2026-08-17 — The footer carries the scene's sky plate under a shell scrim.** The plate is a pale gold dusk — the lightest thing in the palette — so it cannot sit under cream type unscreened; measured raw, the small caps came out near 1:1. An 80→96% shell gradient turns the photograph into a glow, and the plate is anchored to its top edge because the lower two thirds are a lit skyline, palms and a road, which at footer height read as clutter rather than atmosphere. Verified by sampling the real composited pixels behind every text run (worst 5.98:1 against the lightest pixel under any of them) — reading `getComputedStyle(footer).backgroundColor` is meaningless once the ground is an image, and a naive numeric parse of a computed colour is meaningless anyway: they resolve to `oklab(...)` here, so `oklab(0.184 0.013 55.5)` parses as RGB and reports every line at 1.01:1.
- **2026-08-17 — The footer sits on `--shell`, the colour the scene is mounted on (#17110d).** The page opens on that brown and now closes on it, so the film and the site read as one surface. It is a brand surface, not a themed one — defined only on `:root` so `.dark` cannot override it — and deliberately a shade darker than `--foreground`, which is what stops the last ink band and the footer merging into one slab where they meet. Quiet type on it was verified by measurement (worst 6.34:1 at 10px), not by eye: Tailwind's opacity modifier on an oklch colour mixes in oklab rather than blending sRGB alpha, so hand-estimating the result is wrong by about two points of contrast.
- **2026-08-17 — The scene ends on the about sheet; what follows is an ordinary page.** It used to run six beats over a 6600px runway — split frames, a residences bridge, an amenities panel, a sliding card deck over a photo collage. Each spoke a different motion language and together they held the scroll for four thousand pixels to say what three static sections say better. The runway is now 2400px, the about sheet has no exit (the page carries it away when the sticky stage releases), and ~630 lines of CSS, the pointer-parallax loop and the whole slider went with them.
- **2026-08-17 — Navigation is routes, never scroll positions.** `#about`, `#residences` and `#amenities` were markers placed down the scene's runway: not shareable, not indexable, meaningless from any other page, and broken outright from all of them. `/[locale]/{a-propos|about}` is now a real page and the header is the same four links everywhere.
- **2026-08-17 — The header leaves scene mode on the scene's box, not a scroll number.** `scrollY < MOTION.runway` reads as equivalent and is wrong by a full viewport — the sticky stage is still pinned at the end of the runway, so the scene occupies `100vh + runway`. The header spent that last screenful transparent over ordinary page content, printing its legibility halo as grey smudges around the wordmark on cream. It now measures `#scene`'s bottom against the shared `CHROME_BAND`.
- **2026-08-17 — A `loading.tsx` anywhere above a route turns its 404 into a soft 200.** The shell streams before `notFound()` throws, so the status is already sent; the page renders correctly and returns 200 to every crawler. The listings skeleton therefore lives in `properties/(index)/`, which does not wrap `[slug]`, and the detail, contact and legal routes ship no `loading.tsx`. If one of them ever needs streaming, put `<Suspense>` _inside_ the page below the `notFound()` decision — never above it. **This contradicts `.claude/rules/app-router.md`**, which mandates `loading.tsx` on every feature route.
- **2026-08-17 — Next strips its own router headers before `proxy` runs.** `rsc`, `next-router-prefetch` and `next-router-segment-prefetch` are absent there, so a prefetch cannot be detected that way. This mattered because the locale switcher sits in every header, so Next prefetches the _other_ language's URL and the proxy counted it as a choice — silently overwriting the visitor's language. The proxy now records a locale only on `sec-fetch-dest: document`, and the switcher writes the cookie itself on click.
- **2026-08-17 — Prices sort on a converted value, not the raw number.** The fixtures mix MAD and EUR; comparing digits ranked a 12.8M MAD villa above a €3.9M estate. `similarityScore` deliberately does _not_ convert — there a stale rate shifts weighting invisibly, while here not converting produces a visibly false order.
- **2026-08-17 — `localizeProperty` lists every field instead of spreading.** A spread carries `translations` onto the object handed to components, and any component holding that map is one `.en` away from bypassing the fallback rule and rendering a blank description.
- **2026-08-17 — `repository.ts` is exported from the slice barrel** despite being `server-only`, because the boundary rule admits one entry point and changing it needs an ADR. Consequence: importing anything from `@/features/properties` into a client component fails the build naming `server-only`, not the barrel.
- **2026-08-17 — Card focus rings live on the card, not the link.** The stretched title link suppresses its own outline (it would draw a box around the title mid-card); the `<article>` rings itself via `has-[a:focus-visible]`. Suppressing without replacing left the entire grid invisible to keyboard focus.
- **2026-08-17 — `fr-MA` groups thousands with `.`**, so prices render `12.000.000 MAD`. A French-from-France buyer may read that as wrong. Pinned by a test; switching to `fr-FR` is a one-line change to `localeTag`.

## Known gaps

- **Legal copy is placeholder.** The GDPR-expected sections exist and each is marked as unwritten; pages are `noindex` until real text arrives. No owner has been named.
- **Enquiries go nowhere.** Painted door by design (`docs/process/painted-door.md`); the back-office inbox is spec 003. The action is unthrottled, which is harmless while it persists nothing and must be rate-limited before it does not.
- **Content and photography are fixtures.** Twelve Marrakech listings; thirteen stock frames stand in for real photography.

## CUJs covered

- CUJ-01 — land and travel the story, now under a locale segment with the hero search (`e2e/home.spec.ts`)
- CUJ-03 — browse to enquiry (`e2e/properties.spec.ts`, `e2e/enquiry.spec.ts`)
- Supporting: `e2e/i18n.spec.ts` (AC-1), `e2e/a11y.spec.ts` (AC-11)
