# Plan — Belso Luxury

- **Source of truth:** `Belso_Cahier_des_charges.pdf` (Info Progix Inc., v1, French)
- **Scope of this plan:** the **Luxe** site only — `belso-luxury`, properties above 500 000 €
- **Author:** Engineering · **Date:** 2026-08-14 · **Status:** draft, pending client validation
- **Last reconciled against the repository:** 2026-08-31. Sections 2, 3, 4, 6, 7, 8 and 9 were
  rewritten to describe what was actually decided and built. The original phase numbering
  (`002-belso-foundation`, `003-belso-backoffice`) never existed as specs and is gone; §7 now
  maps to the specs that do.

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

| #    | Item                                                                  | Blocks                                   | Status                                                                            |
| ---- | --------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| B-1  | **Hostinger VPS specs** (RAM, CPU, disk, bandwidth)                   | Whole infrastructure decision            | **Closed.** 2 vCPU / 7.8 GB / 96 GB, Paris (ADR-0008) — above the floor below     |
| B-2  | Final domain name                                                     | SSL, canonical URLs, `hreflang`          | **Open.** `NEXT_PUBLIC_SITE_URL` is unset and nothing is deployed yet             |
| B-3  | Exhaustive list of property types and amenity tags                    | DB enums, AI extraction vocabulary       | **Partly closed.** Types and facets are in the schema; the amenity vocabulary the |
|      |                                                                       |                                          | extractor needs is not agreed                                                     |
| B-4  | Exchange-rate rule: manual entry or automatic API                     | Pricing model, cron job                  | **Open.** Spec 004 ships a fixed fixture rate, shown as approximate               |
| B-5  | Whether AI search history is visible in the back-office               | Logging schema (cheap now, costly later) | **Open**, and cheaper to answer late than feared — there is no AI search yet      |
| B-6  | Translation supply: who writes AR / EN / IT / NL content              | Launch date for the remaining locales    | **Open**, and descoped — see §6. The site ships `fr` + `en`                       |
| B-7  | Logo and final typography                                             | Design tokens, header                    | **Open.** Tokens are in place; the mark is not final                              |
| B-8  | SEO budget beyond technical structure (keyword audit, content, links) | Commercial scope, not code               | **Open.** Commercial, not blocking code                                           |
| B-9  | **Who owns the privacy notice** (raised by spec 010)                  | Setting a production `DATABASE_URL`      | **Open, and it gates production.** The site stores names, emails, phone numbers   |
| B-10 | **Which mail provider, and who owns the account** (spec 011)          | Spec 012, the enquiry notification       | **Open.** It is the reason 012 was split out of 011                               |

**B-1 was the real risk, and it came back fine.** The floor this plan set was 4 GB RAM, 2 vCPU,
80 GB NVMe. The box is 2 vCPU / 7.8 GB / 96 GB in Paris, already running Traefik with Let’s
Encrypt (ADR-0008). It also runs n8n, so the two cores are shared — the media pipeline is the
part that will feel that, which is why §7 asks for it to be measured rather than assumed.

**B-9 is the blocking one now.** The database holds real names, emails and phone numbers and no
privacy notice has an owner. That gates pointing anything at a production database at all; it is
not a launch-week task.

**B-6 stopped being a launch risk by being descoped.** The site ships French and English; Arabic,
Italian and Dutch became a later phase, so RTL is a scheduled cost rather than the critical path.
The translation dependency is still real — it just no longer holds the launch date.

---

## 3. Architecture

### 3.1 Hosting — Postgres on the client’s VPS, no Supabase

The client owns a Hostinger VPS and wants to host on it. The question this plan originally
answered was whether to run the **Supabase stack** on that box.
**[ADR-0008](docs/architecture/decisions/0008-postgres-on-our-own-vps.md) answered it differently
and supersedes ADR-0007: plain Postgres, and Supabase is gone from the repository.**

The reasoning, in short. RLS earns its keep when an untrusted browser holds a database key, and
Belso has no such browser — every read goes through a `server-only` repository in Server
Components, and two or three people at the agency do the writing. Self-hosting the full stack
meant roughly eight containers on two shared cores in order to use Postgres and a login form.
Auth is instead first-party: sessions as a Postgres table and scrypt passwords
([ADR-0011](docs/architecture/decisions/0011-sessions-in-postgres.md)), with the storefront and
the back-office holding two different database roles
([ADR-0010](docs/architecture/decisions/0010-two-database-roles.md)), so the role that serves the
public cannot write a listing.

Topology on the VPS as it actually stands:

```
Traefik (TLS via Let’s Encrypt)   ← already there, shared with n8n
 ├── Next.js (standalone output)  ← NOT DEPLOYED YET; B-2 blocks it
 └── Postgres 17 (docker compose)
      ├── belso         migrations, seed, backups — the superuser, never the app
      ├── belso_app     the storefront: select the catalogue, insert an enquiry
      └── belso_editor  the back-office: the only role that writes listings
```

Postgres is bound to the VPS loopback and is not reachable from the internet; local work goes
through an SSH tunnel (`pnpm db:tunnel`). Photographs are files on the VPS disk served by a route
handler rather than out of `public/`, which Next serves from a build-time manifest and so would
not serve a runtime upload from at all.
A nightly `pg_dump` with a rehearsed restore landed with spec 010.

**The media fallback still stands:** if the two shared cores turn out to be the constraint, media
moves to external S3-compatible storage first. That changes the media route’s backing store and
an environment variable, not the application.

### 3.2 Application stack

Unchanged from the skeleton, which is the point: Next.js 16 (App Router, RSC by default), React 19, TypeScript strict, Tailwind v4 tokens, Motion for animation, Zod at every boundary, Zustand per-feature via context. Layer rule stays `app → features → shared → core`, ESLint-enforced.

### 3.3 Slices

| Slice                            | Responsibility                                                                          | State            |
| -------------------------------- | --------------------------------------------------------------------------------------- | ---------------- |
| `src/features/properties/`       | Catalogue and detail reads — **and every catalogue write**, including the back-office’s | Built            |
| `src/features/admin/`            | Sign-in, scrypt passwords, the two-axis login throttle                                  | Built (spec 011) |
| `src/features/enquiries/`        | Contact forms, Zod validation, throttling held in Postgres                              | Built            |
| `src/features/i18n/`             | Locale detection and switching, dictionaries                                            | Built            |
| `src/features/cinematic-scroll/` | The home hero scene                                                                     | Built            |
| `src/features/ai-search/`        | Query parsing, criteria extraction, DB filtering, fallback ranking                      | Not started      |
| `src/features/currency/`         | Rate table, conversion, currency switcher                                               | Not started      |

Two corrections to the original list, both deliberate. There is **no `admin-listings` slice** —
the back-office writes through `src/features/properties/`, because a second slice owning the same
tables would have split the publication rules across two places and one of them would have been
forgotten. And there is **no `admin-inbox` slice** yet: reading enquiries is
[spec 012](specs/012-belso-inbox/spec.md), which B-10 blocks.

Features never import each other. Anything shared goes to `src/components/ui/` or `src/lib/`.

### 3.4 Design system

Already decided and partly implemented — the `cinematic-scroll` slice and the Mostar handoff assets. Phase 1 promotes its palette (warm sand, stone, ink) and Archivo type scale into `src/app/globals.css` tokens so the rest of the site is built from the same values rather than one-off hex codes. Two known gaps to close:

- The scene CSS uses **physical** properties (`left`, `right`, `inset`). Arabic RTL needs **logical** properties (`inline-start`, `inline-end`).
- Animation must respect `prefers-reduced-motion`; the slow-parallax art direction makes this a real accessibility requirement, not a checkbox.

---

## 4. Data model

Single-tenant. **The authorization boundary is the role a connection holds, not RLS** (ADR-0008,
ADR-0010). The storefront connects as `belso_app`, which may select the catalogue and insert an
enquiry and nothing else — it cannot read an enquiry back, let alone write a listing. The
back-office connects as `belso_editor`. Those grants are written as executable assertions in
`db/checks/role-grants.sql` and run by a test, so the split is verified rather than believed.

The sketch below is the shape this plan set out. **The schema as built is `db/migrations/0001`
through `0006`**, described in [docs/architecture/backend.md](docs/architecture/backend.md).
Three differences before you read the sketch as truth: `publication` (draft / published /
archived) and `status` (available / under offer / sold / rented) are separate axes, because
conflating them makes a sold listing invisible and an archived one purchasable; slug history is
written by a trigger rather than by the application, because a back-office that renames a listing
and forgets to record the old address is exactly the failure being guarded against; and `0005`
added the account, session and row-version tables the sketch never had.

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

**Locales:** `fr` (default) and `en` are built and shipping. `ar`, `it` and `nl` are structurally
unblocked and not built — the routing, the dictionaries and the per-locale translation rows all
take them; no content exists. The five-at-launch commitment was traded away deliberately in spec
004 and confirmed in spec 011: a listing publishes with **French alone** and appears on the
English site in French, carrying an untranslated note. Requiring a translation before publishing
would either hold finished properties off the site or produce hurried English that reads worse
than the honest note.

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

### What has shipped

The original Phase 0 / 1 / 2 numbering was overtaken by events: there was never a
`002-belso-foundation` or a `003-belso-backoffice`. The foundation was not one phase but was
spread across the storefront and the data layer, and the back-office arrived last rather than
second — building the public site on fixtures first meant the design was settled before there was
a database to argue with. This is the real ledger:

| Spec                                       | What it delivered                                                                    | Status                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [004](specs/004-belso-public/spec.md)      | The public storefront on fixtures: home, listing detail, contact, legal, `fr` + `en` | Shipped 2026-08-17                                       |
| [009](specs/009-belso-map/spec.md)         | Map view of the catalogue (MapLibre, ADR-0009)                                       | Active — [report](docs/reports/009-belso-map.md)         |
| [010](specs/010-belso-data-layer/spec.md)  | Postgres replaces the fixtures; enquiries stored; backup and rehearsed restore       | Shipped — [report](docs/reports/010-belso-data-layer.md) |
| [011](specs/011-belso-back-office/spec.md) | The editor: sign in, draft, publish, translate later, rename, archive, photographs   | Code-complete; verification and ship remain              |
| [012](specs/012-belso-inbox/spec.md)       | The agency is told when someone writes                                               | Draft, blocked on B-10                                   |

Spec 001 is the skeleton’s demo feature, not Belso.

**Owner autonomy — the success condition this plan opened with — is met in code and not in
production**, because nothing is deployed: B-2 has no domain and B-9 has no privacy notice. What
is left of spec 011 is verification and review, not building.

### What remains

Numbers 005–008 stay reserved for the four phases below, as spec 009’s tasks record.

**Finish spec 011.** `/security-review` — a new auth surface, a new credential, file upload and
PII all landed in one spec, so this one is not optional — then `/review`, the feature report and
the docs pass. The editor’s save time against the two shared cores has not been measured, and the
upload path is fifteen sequential decode-and-encode cycles; that is the number worth knowing
before the client meets it.

**Spec 012 — the inbox.** Enquiries are stored and nobody is told, while the contact page promises
a reply within 24 hours. B-10 first.

**AI search → `specs/005-belso-ai-search/`.** Extraction endpoint, Zod contract, SQL filter
builder, fallback ranking, `search_queries` logging, rate limiting, spend cap, no-AI degraded
mode. Similar-properties reuses the same ranking function. Needs B-3’s vocabulary.

_Done when:_ a fixture suite of real-world queries extracts correctly, empty-result queries return
exactly 3 ranked fallbacks, and the endpoint rejects abuse.

**Content and currency → `specs/006-belso-content/`.** The remaining locales including Arabic and
RTL, the currency switcher, the rate cron with a manual override (B-4), real listing data, real
photography.

**SEO and performance → `specs/007-belso-seo/`.** `hreflang`, sitemaps, structured data, metadata
defaults, image pipeline tuning, Lighthouse and Core Web Vitals on real content at real weight.

**Hardening and launch → `specs/008-belso-launch/`.** The privacy notice (B-9) and consent
handling, invisible captcha, the domain and SSL (B-2), **deploying the application to the VPS at
all**, off-VPS backups of the machine as well as of the database, uptime and error monitoring,
load test at expected peak, DNS cutover.

**Handover.** Back-office manual in French (the client’s working language), with screenshots.
Runbook: backups, restore, dependency updates, what to do when the AI budget cap trips.

**Outside every phase, and worth putting to the owner: there is no CI.** Every gate here is run by
hand; `.github/` holds a CODEOWNERS file and a PR template and no workflows. A workflow running
`pnpm verify` on push needs no secrets, since the build is meant to work without a database, and
would have caught a prerender failure that reached a branch during spec 011.

---

## 8. Verification

The harness attests, not the author. Per `docs/process/definition-of-done.md`:

- `pnpm verify` green — lint, typecheck, format, docs, typography, tests, build.
- `pnpm test:db` green against `belso_test`, and `pnpm verify:db` — migrate, seed, database tests,
  restore check — as one command. Both suites refuse a database whose name is not a scratch one:
  they write, and a previous session wrote into the client’s live table.
- `db/checks/role-grants.sql` green: the role split asserted, negative cases included —
  `belso_app` must fail to write a listing and fail to read an enquiry back.
- Playwright CUJs with screenshots: home → search → listing → enquiry; back-office create → publish; locale switch; currency switch; RTL rendering.
- Lighthouse ≥ 90 performance / 100 SEO on the listing template with real photography.
- `pnpm web:check` and the `SEC-*` catalogue in `docs/security/checklist.md`.

## 9. Risks

| Risk                                 | Impact                  | Mitigation                                                                   |
| ------------------------------------ | ----------------------- | ---------------------------------------------------------------------------- |
| VPS shares two cores with n8n        | Media pipeline stalls   | Measure the editor’s save time before handover; media-to-S3 fallback (§3.1)  |
| No privacy notice (B-9)              | Cannot go live          | An owner assigned before any production `DATABASE_URL` is set                |
| Translations arrive late (B-6)       | Locales slip            | No longer a launch risk — `fr` publishes alone, `en` falls back visibly (§6) |
| RTL underestimated                   | Rework in phase 3       | Logical properties from phase 1; Arabic in the CUJ suite from day one        |
| HQ photography kills Core Web Vitals | SEO priority missed     | Image budget enforced in phase 1, measured continuously, not at the end      |
| Self-hosting operational burden      | Post-launch fragility   | Runbook + the restore rehearsed in spec 010; the cost is stated in ADR-0008  |
| No CI; every gate is run by hand     | A bad push reaches main | Proposed in §7 — `pnpm verify` on push, no secrets needed                    |
| AI search abused                     | Cost spike              | Rate limit + spend cap + cache, all in phase 4 scope                         |
| Client later wants both sites synced | Architectural rework    | Anti-goal recorded here; a change of mind is an R2R, not a bug fix           |

## 10. Open questions for the client

Everything in §2, plus: does the manager want to **duplicate** a listing across both sites (the cahier des charges says no automatic sync, but a manual “copy to the other site” export could save her real time later)? Cheap to design for now, expensive to retrofit.

---

_Grounded in `Belso_Cahier_des_charges.pdf` §1–9. This plan is a working document — it is validated with the client before phase 1, and updated through the R2R process (`docs/process/r2r.md`) when requirements change afterwards._
