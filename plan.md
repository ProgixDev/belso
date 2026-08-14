# Plan — Belso Luxury

- **Source of truth:** `Belso_Cahier_des_charges.pdf` (Info Progix Inc., v1, French)
- **Scope of this plan:** the **Luxe** site only — `belso-luxury`, properties above 500 000 €
- **Author:** Engineering · **Date:** 2026-08-14 · **Status:** draft, pending client validation

This is the master delivery roadmap. It does not replace the spec-driven workflow: each phase below becomes a `specs/NNN-slug/` folder (`spec.md` → `plan.md` → `tasks.md`) before any code is written. See `AGENTS.md` for the loop.

---

## 1. What we are building

Belso is a Marrakech real-estate agency run by a single person (the manager). She needs a premium digital storefront where a visitor types a sentence in plain language — “villa moderne à Marrakech avec vue sur l’Atlas entre 8 et 12M MAD” — and gets a relevant selection back, instead of the usual dropdown-and-checkbox filter wall.

**Belso Luxury** is the high-end half: properties over 500 000 €, **sale and long-term rental**, its own domain, its own back-office, its own database. The manager assigns each property to a site manually at creation; there is no automatic switching if the price later changes.

### Success conditions

| Goal                  | Measurable outcome                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Premium storefront    | Every page clears `docs/design/quality-bar.md`; LCP ≤ 2.5 s on 4G despite full-bleed photos             |
| Owner autonomy        | Manager creates, edits, publishes and archives a listing end-to-end with zero dev involvement           |
| Differentiated search | Natural-language query → structured criteria → DB filter, with a 3-nearest fallback that is never empty |
| International reach   | 5 locales indexed with correct `hreflang`; `RealEstateListing` structured data on every listing         |
| Centralised enquiries | Every contact form lands in the back-office inbox with a processing status, plus an email alert         |

### Anti-goals (protect the scope)

- **The Classique site is out of scope here.** It is a separate deployment with a separate database. We build Luxury so it can be **cloned**, not so it can be multi-tenanted — no `site_id` column, no shared back-office, no cross-site sync. That is what the cahier des charges asks for and it is much cheaper to keep it that way.
- No multi-user roles, no permissions matrix. One account: the manager.
- No public user accounts, no favourites, no saved searches, no online transactions.
- No semantic AI matching over the whole catalogue (see §4 — deliberately rejected on cost).
- No external CRM integration in v1 (internal messages module instead).

---

## 2. Blocking items — resolve before phase 1

These come from §9 of the cahier des charges. Phase 0 exists only to close them; some genuinely block code.

| #   | Item                                                                  | Blocks                                   | Severity |
| --- | --------------------------------------------------------------------- | ---------------------------------------- | -------- |
| B-1 | **Hostinger VPS specs** (RAM, CPU, disk, bandwidth)                   | Whole infrastructure decision            | Blocking |
| B-2 | Final domain name                                                     | SSL, canonical URLs, `hreflang`          | Blocking |
| B-3 | Exhaustive list of property types and amenity tags                    | DB enums, AI extraction vocabulary       | Blocking |
| B-4 | Exchange-rate rule: manual entry or automatic API                     | Pricing model, cron job                  | High     |
| B-5 | Whether AI search history is visible in the back-office               | Logging schema (cheap now, costly later) | Medium   |
| B-6 | Translation supply: who writes AR / EN / IT / NL content              | Launch date for 5 locales                | High     |
| B-7 | Logo and final typography                                             | Design tokens, header                    | Medium   |
| B-8 | SEO budget beyond technical structure (keyword audit, content, links) | Commercial scope, not code               | Low      |

**B-1 is the real risk.** One Next.js app + Postgres + an object store + 5 locales + heavy imagery on an entry-level VPS (1–2 GB RAM) will not hold. Realistic floor: **4 GB RAM, 2 vCPU, 80 GB NVMe**. If the current plan is smaller, the options are a Hostinger tier upgrade or offloading media to external object storage (S3-compatible) — both should be priced before development starts, not after.

**B-6 is the second risk.** The client asked for all five languages at launch. Arabic in particular means RTL layout work, not just strings. Translation delivery must be scheduled as a client dependency with a hard date, or launch slips.

---

## 3. Architecture

### 3.1 Hosting — self-hosted on the client’s VPS

The repository is currently wired for hosted Supabase (ADR-0007). The client owns a Hostinger VPS and wants to use it, so **this plan targets self-hosted Supabase via Docker Compose on that VPS**, not hosted Supabase.

Rationale: self-hosting Supabase (Postgres + GoTrue auth + Storage + PostgREST) keeps every pattern already built in this repo — the SSR cookie clients in `src/lib/supabase/`, the RLS-first migrations, the pgTAP tests — while satisfying the “on my VPS” requirement. Swapping to plain Postgres + a hand-rolled auth layer would throw that away and add work with no benefit for a single-user back-office.

**This contradicts ADR-0007 and therefore requires ADR-0008 (“Self-hosted Supabase on Hostinger VPS”) written and accepted before phase 1 code.** ADR-0008 must state honestly what self-hosting costs us: we now own upgrades, backups, disk monitoring, SSL renewal and incident response. That is the price of the requirement.

Target topology on the VPS:

```
Caddy (TLS, HTTP/3, static cache)
 ├── Next.js (standalone output, PM2 or Docker)
 └── Supabase stack (docker compose)
      ├── Postgres 16  ← nightly pg_dump to off-VPS storage
      ├── GoTrue (auth — one user)
      ├── Storage (HQ photos, S3-on-disk driver)
      └── PostgREST / Kong
```

**Fallback documented in ADR-0008:** if B-1 comes back short, media moves to external S3-compatible storage first (biggest win per euro), and hosted Supabase stays the escape hatch — the application code is identical either way, only environment variables change.

### 3.2 Application stack

Unchanged from the skeleton, which is the point: Next.js 16 (App Router, RSC by default), React 19, TypeScript strict, Tailwind v4 tokens, Motion for animation, Zod at every boundary, Zustand per-feature via context. Layer rule stays `app → features → shared → core`, ESLint-enforced.

### 3.3 Slices

| Slice                            | Responsibility                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| `src/features/properties/`       | Listing queries, detail fetch, similar-properties matching         |
| `src/features/ai-search/`        | Query parsing, criteria extraction, DB filtering, fallback ranking |
| `src/features/enquiries/`        | Contact forms (listing + general), spam protection                 |
| `src/features/admin-listings/`   | Back-office CRUD, media ordering, status, SEO fields               |
| `src/features/admin-inbox/`      | Messages list, processing status, history                          |
| `src/features/i18n/`             | Locale detection and switching, dictionaries, RTL direction        |
| `src/features/currency/`         | Rate table, conversion, currency switcher                          |
| `src/features/cinematic-scroll/` | **Already built** — the home hero scene, to be adapted             |

Features never import each other. Anything shared goes to `src/components/ui/` or `src/lib/`.

### 3.4 Design system

Already decided and partly implemented — the `cinematic-scroll` slice and the Mostar handoff assets. Phase 1 promotes its palette (warm sand, stone, ink) and Archivo type scale into `src/app/globals.css` tokens so the rest of the site is built from the same values rather than one-off hex codes. Two known gaps to close:

- The scene CSS uses **physical** properties (`left`, `right`, `inset`). Arabic RTL needs **logical** properties (`inline-start`, `inline-end`).
- Animation must respect `prefers-reduced-motion`; the slow-parallax art direction makes this a real accessibility requirement, not a checkbox.

---

## 4. Data model

Single-tenant. All tables live in `public`, RLS enabled by the `0001` event trigger, one policy per command.

**Read access is public** (anonymous visitors read published listings); **write access is the manager only**. That is the inverse of the skeleton’s owner-scoped `notes` pattern, so the policies must be written deliberately rather than copied.

```
properties
  id, reference (unique, human-readable e.g. BL-0042)
  status            available | under_offer | sold | rented | archived
  visibility        draft | published
  transaction       sale | long_term_rental
  property_type     villa | riad | apartment | penthouse | land | farm | …  (B-3)
  price_amount, price_currency (MAD|EUR|USD)   ← source of truth, one currency
  city, district, lat, lng
  land_area_sqm, built_area_sqm, bedrooms, bathrooms
  created_at, updated_at, published_at

property_translations          (property_id, locale) unique
  title, description_rich, seo_title, seo_description, seo_keywords, slug

property_amenities             (property_id, amenity_id)
amenities                      slug, icon        ← shared vocabulary with AI extraction (B-3)
amenity_translations           (amenity_id, locale) label

property_media
  property_id, storage_path, alt_translations jsonb, sort_order, width, height, blurhash

enquiries
  property_id (nullable — general contact), name, email, phone, message
  locale, status (new | in_progress | closed), created_at, notes

search_queries                 ← B-5; log from day one, surface later
  raw_query, locale, extracted_criteria jsonb, result_count, used_fallback, created_at

exchange_rates                 base_currency, quote_currency, rate, source, updated_at
page_translations              static page copy + per-page SEO metadata
```

Design notes worth stating up front:

- **One price, one currency.** Storing three prices invites them to drift. The manager enters the real asking price in its real currency; everything else is a conversion, displayed with `≈` and the original alongside it, exactly as §3.2 of the cahier des charges asks.
- **Amenities are rows, not free text.** The same vocabulary feeds the filter, the listing page and the AI extractor. Free-text tags would make AI matching unreliable.
- **`reference` is generated and immutable** — it is what the pre-filled contact form quotes.
- **Translations are separate rows, not JSON columns**, so a missing Italian description is a missing row we can query for, not a silent empty string. The back-office shows translation completeness per listing.

---

## 5. AI search

### 5.1 The pipeline (as specified, and it is the right call)

```
visitor sentence
   → OpenAI structured-output call: extract criteria only
   → Zod validation of the returned JSON
   → SQL query against properties (no AI in the loop)
   → 0 results? → relaxation ranking → 3 nearest listings
   → log to search_queries
```

The model **never sees the catalogue**. It only turns prose into a criteria object. This keeps cost flat as the catalogue grows from 100 to 500 listings — the alternative (semantic matching over every listing) costs more and gets worse with scale. Confirm this with the client, then stop revisiting it.

### 5.2 Extraction contract

One Zod schema, converted to a JSON schema for OpenAI structured outputs, so a malformed response is impossible rather than merely unlikely:

```ts
{ transaction?, propertyType?, city?, district?,
  budgetMin?, budgetMax?, budgetCurrency?,
  bedroomsMin?, bathroomsMin?, minAreaSqm?,
  amenities?: string[],       // constrained to the amenities vocabulary
  freeText?: string }
```

Every field optional — a vague query should return a broad result set, not an error. Anything the model cannot map to the vocabulary goes to `freeText` and is ignored by the filter.

### 5.3 Fallback ranking

When the strict filter returns nothing, score every published listing and take the top 3. Weighted distance, computed in SQL, no second AI call:

| Dimension     | Weight | Distance                              |
| ------------- | ------ | ------------------------------------- |
| Budget        | 0.35   | Normalised distance outside the range |
| Property type | 0.25   | Exact match or not                    |
| District/city | 0.20   | Same district > same city > elsewhere |
| Amenities     | 0.15   | Jaccard overlap with requested tags   |
| Bedrooms      | 0.05   | Absolute difference                   |

The UI must be honest about what happened: “No exact match — here are the three closest.” Never present a fallback as a match.

### 5.4 Cost and abuse

The cahier des charges estimates $0.10–$2.00/month at 1 000–10 000 visits. That holds only if the endpoint is protected. Required, not optional:

- Rate limit per IP (e.g. 10 searches/minute, 100/day) enforced server-side before the model call.
- A hard monthly spend cap at the OpenAI account level.
- Query length cap (~300 chars) and a cache on normalised repeat queries.
- Prompt-injection hygiene: the extractor’s output is data for a SQL builder, never an instruction. Zod validation is the boundary.

The same slice must also work with **no** AI: if the API is down or the cap is hit, degrade to keyword search over title, district and amenities. The site never shows a broken search bar.

---

## 6. Internationalisation, currency, SEO

**Locales:** `fr` (default), `ar`, `en`, `it`, `nl` — all five at launch, per the client’s decision.

- Routing: `/[locale]/…`, `fr` as default. `hreflang` for all five plus `x-default`. Slugs translated per locale (`/en/properties/villa-atlas-view` vs `/fr/biens/villa-vue-atlas`).
- Detection: `Accept-Language` header on first visit, persisted in a cookie, always manually overridable. **Never redirect based on IP without letting the user out of it** — it breaks crawlers and infuriates expats.
- **Arabic is RTL.** `dir="rtl"`, logical CSS properties, mirrored gallery navigation, Arabic numeral formatting. Budget real time for this; it is the most commonly underestimated item in this plan.
- Currencies: MAD, EUR, USD. Rates in `exchange_rates`, refreshed by a daily cron from an FX API with a manual override in the back-office (B-4). Show the converted value with `≈` next to the original.

**SEO** is a stated top priority (“référencement +++”), so it is a phase, not a polish pass:

- `RealEstateListing` JSON-LD per listing; `RealEstateAgent` on the organisation.
- Per-locale sitemaps with a sitemap index; per-locale `robots`.
- SEO title/description/keywords editable per listing **and** per locale from the back-office, with sensible generated defaults so an empty field never becomes an empty tag.
- Image discipline is the SEO risk here: full-bleed HQ photography versus Core Web Vitals. AVIF/WebP via `next/image`, explicit dimensions, blurhash placeholders, `priority` only on the hero, `sharp` installed on the VPS. Budget: LCP ≤ 2.5 s, CLS ≤ 0.1, verified on throttled 4G.

---

## 7. Delivery phases

Each phase = one spec folder, one branch, one review, one report. `pnpm verify` green at every step.

### Phase 0 — Unblock (no code)

Close B-1 through B-8. Deliverables: VPS audit report with a go/no-go on capacity, confirmed domain, final property-type and amenity vocabulary, signed-off exchange-rate rule, translation delivery schedule. **Do not start phase 1 on an unaudited VPS.**

### Phase 1 — Foundation → `specs/002-belso-foundation/`

ADR-0008 (self-hosted Supabase). Docker Compose stack provisioned on the VPS. Full schema + RLS policies + pgTAP tests for public-read/owner-write. Design tokens promoted from the cinematic-scroll palette. `/[locale]` routing skeleton with dictionaries and RTL support. Manager auth (one account, MFA on).

_Done when:_ `supabase test db` green, a seeded listing renders in all five locales at a placeholder URL, Arabic renders RTL without layout breakage.

### Phase 2 — Back-office → `specs/003-belso-backoffice/`

Listing CRUD with the full field set. Media upload with drag-to-reorder, server-side resize, alt text per locale. Status and visibility workflow. Per-locale SEO fields with translation-completeness indicators. Messages inbox with processing status.

_Done when:_ the manager creates a complete bilingual listing, uploads and reorders 15 photos, publishes it, and sees it live — screenshot-evidenced, no dev involvement.

### Phase 3 — Public site → `specs/004-belso-public/`

Home page: the existing cinematic scroll adapted to Marrakech imagery, with the single centred search bar. Listing detail: HQ gallery, key facts, dual-currency price, map, similar properties, pre-filled contact form. General contact page. Legal pages (privacy, cookies, terms).

_Done when:_ the browse-to-enquiry CUJ passes e2e with screenshots, and the pages clear `docs/design/quality-bar.md`.

### Phase 4 — AI search → `specs/005-belso-ai-search/`

Extraction endpoint, Zod contract, SQL filter builder, fallback ranking, `search_queries` logging, rate limiting, spend cap, no-AI degraded mode. Similar-properties block reuses the same ranking function.

_Done when:_ a fixture suite of ~30 real-world queries across all five languages extracts correctly, empty-result queries return exactly 3 ranked fallbacks, and the endpoint rejects abuse.

### Phase 5 — Content and currency → `specs/006-belso-content/`

Translation import for all five locales, currency switcher, rate cron with manual override, real listing data loaded, real photography.

### Phase 6 — SEO and performance → `specs/007-belso-seo/`

`hreflang`, sitemaps, structured data, metadata defaults, image pipeline tuning, Lighthouse and Core Web Vitals passes on real content at real weight.

### Phase 7 — Hardening and launch → `specs/008-belso-launch/`

Invisible captcha on forms, GDPR cookie banner and consent handling, SSL, nightly off-VPS backups with a **tested restore**, uptime and error monitoring, load test at expected peak, DNS cutover.

### Phase 8 — Handover

Back-office manual in French (the client’s working language), with screenshots. Runbook: backups, restore, dependency updates, what to do when the AI budget cap trips.

---

## 8. Verification

The harness attests, not the author. Per `docs/process/definition-of-done.md`:

- `pnpm verify` green — lint, typecheck, format, docs, typography, tests, build.
- `supabase test db` green for every RLS policy, including negative cases (anonymous write must fail).
- Playwright CUJs with screenshots: home → search → listing → enquiry; back-office create → publish; locale switch; currency switch; RTL rendering.
- Lighthouse ≥ 90 performance / 100 SEO on the listing template with real photography.
- `pnpm web:check` and the `SEC-*` catalogue in `docs/security/checklist.md`.

## 9. Risks

| Risk                                 | Impact                | Mitigation                                                                    |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| VPS undersized (B-1)                 | Blocks everything     | Phase 0 audit; media-to-S3 fallback; hosted Supabase escape hatch in ADR-0008 |
| Translations arrive late (B-6)       | Launch slips          | Hard client deadline; per-locale publish gate so `fr`/`en` can ship first     |
| RTL underestimated                   | Rework in phase 3     | Logical properties from phase 1; Arabic in the CUJ suite from day one         |
| HQ photography kills Core Web Vitals | SEO priority missed   | Image budget enforced in phase 1, measured continuously, not at the end       |
| Self-hosting operational burden      | Post-launch fragility | Runbook + tested restore in phase 7; state the cost plainly in ADR-0008       |
| AI search abused                     | Cost spike            | Rate limit + spend cap + cache, all in phase 4 scope                          |
| Client later wants both sites synced | Architectural rework  | Anti-goal recorded here; a change of mind is an R2R, not a bug fix            |

## 10. Open questions for the client

Everything in §2, plus: does the manager want to **duplicate** a listing across both sites (the cahier des charges says no automatic sync, but a manual “copy to the other site” export could save her real time later)? Cheap to design for now, expensive to retrofit.

---

_Grounded in `Belso_Cahier_des_charges.pdf` §1–9. This plan is a working document — it is validated with the client before phase 1, and updated through the R2R process (`docs/process/r2r.md`) when requirements change afterwards._
