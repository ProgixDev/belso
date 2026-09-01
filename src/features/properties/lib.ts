import { convert, displayCurrency } from "@/core/currency";
import { defaultLocale, type Locale } from "@/core/i18n";
import { districts } from "./districts";
import type {
  Coordinates,
  LocalizedProperty,
  Property,
  PropertyLocation,
  PropertySort,
  PropertyTranslation,
} from "./types";

/**
 * The pure half of the properties slice: resolving translations, matching a
 * visitor's words, ordering, and scoring similarity. No I/O, no `server-only` —
 * `repository.ts` composes these, and they are directly unit-testable, which is
 * how AC-3 and AC-9 are proven without a browser.
 */

/* -------------------------------------------------------------------------- */
/* Where a listing sits on the map                                             */
/* -------------------------------------------------------------------------- */

/**
 * How far from its district's centre a derived point may fall, in metres.
 *
 * Wide enough that two listings in the same district are visibly separate
 * rather than one pin on top of another, tight enough that the pin stays in the
 * part of Marrakech the listing is actually in. It is not a claim about the
 * property — `precision: "approximate"` and the caveat on screen are.
 */
const SCATTER_METRES = 800;

/** Metres per degree of latitude. Close enough anywhere; longitude needs the cosine. */
const METRES_PER_DEGREE = 111_320;

/**
 * FNV-1a, 32-bit.
 *
 * Small, dependency-free, and above all **stable**: the same reference must
 * produce the same point on the server and again in the browser, on this build
 * and the next one. `Math.random` would put the pin somewhere else on every
 * render and hydrate to a different map than the one that was sent.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Five decimals is about a metre. The number is exact; what it describes is not. */
const round = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * A stable point inside a district, for a listing that has no coordinate.
 *
 * We have no addresses. The choice was between leaving twenty properties off
 * the map, writing twenty invented coordinates into the fixtures, or deriving
 * them from something true — the district each listing is genuinely in. This is
 * the third, kept in one named function so the fabrication has exactly one
 * home instead of being scattered through the data as twenty numbers that look
 * surveyed.
 *
 * The square root is not decoration: without it the angle-and-radius pair
 * bunches points around the centre, because a disc has more area at its rim.
 */
export function approximateLocation(seed: string, center: Coordinates): Coordinates {
  const seeded = hash(seed);
  const angle = ((seeded % 3600) / 3600) * Math.PI * 2;
  const radius = Math.sqrt((((seeded >>> 12) % 1000) + 1) / 1000) * SCATTER_METRES;

  const latitude = center.lat + (radius * Math.cos(angle)) / METRES_PER_DEGREE;
  const longitude =
    center.lng +
    (radius * Math.sin(angle)) / (METRES_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));

  return { lat: round(latitude), lng: round(longitude) };
}

/**
 * The listing's own coordinate when it has one, its district otherwise — and
 * which of the two it was.
 */
export function resolveLocation(property: Property): PropertyLocation {
  if (property.coordinates) return { ...property.coordinates, precision: "exact" };
  return {
    ...approximateLocation(property.reference, districts[property.districtId].center),
    precision: "approximate",
  };
}

/* -------------------------------------------------------------------------- */
/* Translation fallback (AC-9)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a property's text for one locale, falling back to the default locale
 * when it has not been translated yet.
 *
 * Returns the flag rather than letting the UI infer it: a component comparing
 * strings, or testing for an empty description, would quietly stop showing the
 * note the day someone writes an English title but no English body. Returns
 * null only when the property has no text in *any* locale, which is a data bug
 * the repository is expected to drop rather than render.
 */
export function resolveTranslation(
  property: Property,
  locale: Locale,
): (PropertyTranslation & { textLocale: Locale; isFallback: boolean }) | null {
  const requested = property.translations[locale];
  if (requested) return { ...requested, textLocale: locale, isFallback: false };

  const fallback = property.translations[defaultLocale];
  if (fallback) return { ...fallback, textLocale: defaultLocale, isFallback: true };

  const [textLocale, translation] = Object.entries(property.translations)[0] ?? [];
  if (!translation) return null;
  return { ...translation, textLocale: textLocale as Locale, isFallback: true };
}

/**
 * The alt text for one photograph, in the language of the page.
 *
 * The same three steps as `resolveTranslation`, for the same reason: asked-for
 * language, then the default, then whatever exists. A caption written in French
 * alone must still describe the photograph on the English site — a French
 * sentence read by an English voice is imperfect and is enormously better than
 * silence, or than a screen reader falling back to announcing a file name.
 *
 * The last resort is `""`, which is not laziness: an empty `alt` tells a screen
 * reader the image is decorative and to skip it. That is a small lie about a
 * photograph of a house, and it is the correct one when there is genuinely no
 * text — the alternative, `undefined`, makes the browser read out the URL.
 *
 * It cannot be reached today (`fixtures/properties.test.ts` requires both
 * locales on every seeded photograph) and it will be reachable the moment the
 * back-office writes its first caption.
 */
/**
 * How many photographs the site has no description for, in any language.
 *
 * **Defined as "`altFor` would return nothing", not "the French box is empty".**
 * That is the condition with a consequence: the gallery falls back to a
 * positional label, so a screen reader hears "Photo 3 sur 15" instead of what
 * the room is. A photograph described in English alone is imperfect and is not
 * this problem.
 *
 * The editor shows the count; it never blocks publishing. The spec refused that
 * trade for translations — a finished property must not sit off the site
 * waiting for prose — and alt text does not get a stricter rule than the
 * listing text it accompanies.
 */
export function undescribedCount(
  media: readonly { alt: Partial<Record<Locale, string>> }[],
): number {
  return media.filter((item) => Object.values(item.alt).every((text) => !text?.trim())).length;
}

export function altFor(alt: Partial<Record<Locale, string>>, locale: Locale): string {
  return alt[locale] ?? alt[defaultLocale] ?? Object.values(alt)[0] ?? "";
}

/**
 * Flatten a property into the shape components render. Null when it has no text
 * at all.
 *
 * Every field is listed rather than spread from `property`, so `translations`
 * cannot ride along: a component handed the whole map would be one `.en` away
 * from bypassing the fallback rule and rendering a blank description.
 */
export function localizeProperty(property: Property, locale: Locale): LocalizedProperty | null {
  const translation = resolveTranslation(property, locale);
  if (!translation) return null;

  return {
    id: property.id,
    reference: property.reference,
    districtId: property.districtId,
    kind: property.kind,
    type: property.type,
    status: property.status,
    price: property.price,
    currency: property.currency,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    builtArea: property.builtArea,
    landArea: property.landArea,
    builtYear: property.builtYear,
    parking: property.parking,
    amenities: property.amenities,
    media: property.media,
    listedAt: property.listedAt,
    location: resolveLocation(property),
    locale,
    textLocale: translation.textLocale,
    isFallback: translation.isFallback,
    slug: translation.slug,
    title: translation.title,
    description: translation.description,
    district: translation.district,
    city: translation.city,
  };
}

/* -------------------------------------------------------------------------- */
/* Matching a visitor's own words (AC-2, AC-4)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Words too common to carry intent in either shipped language. Without this,
 * "villa **avec** vue" matches every listing whose description contains "avec",
 * which is all of them — and an unfilterable result set makes AC-4's empty
 * state unreachable.
 */
const STOPWORDS = new Set([
  // fr
  "avec",
  "pour",
  "dans",
  "les",
  "des",
  "une",
  "sur",
  "aux",
  "chez",
  "entre",
  "plus",
  "est",
  "sont",
  "par",
  "vers",
  "sans",
  "mais",
  "que",
  "qui",
  "son",
  "sa",
  "ses",
  "leur",
  "cette",
  // en
  "the",
  "and",
  "with",
  "for",
  "from",
  "that",
  "this",
  "have",
  "has",
  "are",
  "into",
  "near",
  "any",
  "all",
  "its",
  "their",
]);

/** Lowercase and strip accents, so "Marrakech" finds "marrakech" and "à" finds "a". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Split a sentence into the words worth matching on. Tokens shorter than three
 * characters go too — that is what drops the digits out of "entre 8 et 12 M MAD"
 * without needing to understand that it was a budget.
 */
export function tokenize(query: string): string[] {
  return [
    ...new Set(
      normalize(query)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    ),
  ];
}

/** Everything about a property a query may plausibly be aimed at. */
function haystack(property: Property): string {
  const text = Object.values(property.translations)
    .filter((t): t is PropertyTranslation => Boolean(t))
    .flatMap((t) => [t.title, t.description, t.district, t.city]);

  return normalize(
    [...text, property.type, property.kind, property.reference, ...property.amenities].join(" "),
  );
}

/**
 * How well a property answers a query: the number of distinct meaningful words
 * it contains. Zero means no match.
 *
 * Deliberately literal. The spec puts AI extraction and nearest-match ranking
 * in Phase 4 and is explicit that until then an unmatched search says so rather
 * than guessing — so this must be able to return nothing.
 */
export function matchScore(property: Property, query: string): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 1;
  const text = haystack(property);
  return tokens.filter((token) => text.includes(token)).length;
}

/* -------------------------------------------------------------------------- */
/* Ordering (AC-3)                                                             */
/* -------------------------------------------------------------------------- */

export const defaultSort: PropertySort = "newest";

/**
 * Comparable value for ordering: every price converted to one currency.
 *
 * Sorting on the raw number is wrong the moment two currencies are in the same
 * set — a 12 800 000 MAD villa (about €1.2M) outranks a €3 900 000 estate on
 * digits alone, and the grid confidently shows the cheaper property first.
 *
 * This does lean on the provisional rate table (B-4). That is the lesser evil:
 * a slightly stale rate shifts neighbouring listings, while not converting at
 * all produces an order that is simply false. Note the difference from
 * `similarityScore`, which refuses to convert — there the effect would be an
 * invisible change in weighting rather than a visibly wrong sequence.
 */
function comparablePrice(property: Property): number {
  return convert(property.price, property.currency, displayCurrency) ?? property.price;
}

/**
 * Comparators, keyed by the sort a visitor picked. Each falls back to the
 * reference so equal-priced listings keep a stable order between renders —
 * without it a grid reshuffles on every request and looks broken.
 */
export const sortComparators: Record<PropertySort, (a: Property, b: Property) => number> = {
  newest: (a, b) =>
    Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.reference.localeCompare(b.reference),
  priceAsc: (a, b) =>
    comparablePrice(a) - comparablePrice(b) || a.reference.localeCompare(b.reference),
  priceDesc: (a, b) =>
    comparablePrice(b) - comparablePrice(a) || a.reference.localeCompare(b.reference),
};

export function sortProperties(
  properties: Property[],
  sort: PropertySort = defaultSort,
): Property[] {
  return [...properties].sort(sortComparators[sort]);
}

/* -------------------------------------------------------------------------- */
/* Similar properties (AC-5)                                                   */
/* -------------------------------------------------------------------------- */

/** Within this much of the subject's price counts as the same bracket. */
const PRICE_BRACKET = 0.25;

/**
 * Closeness to a subject property. Weighted so that "another villa in the same
 * district at a similar price" outranks "anything else in Marrakech" — a
 * similar-properties row that just lists the newest four is noise.
 */
export function similarityScore(subject: Property, candidate: Property): number {
  if (candidate.id === subject.id) return -1;

  let score = 0;
  if (candidate.kind === subject.kind) score += 3;
  if (candidate.type === subject.type) score += 3;

  const subjectText = subject.translations[defaultLocale];
  const candidateText = candidate.translations[defaultLocale];
  if (subjectText && candidateText) {
    if (candidateText.city === subjectText.city) score += 2;
    if (candidateText.district === subjectText.district) score += 2;
  }

  // Only comparable within one currency; converting here would bake an
  // unresolved FX rule (B-4) into ranking, where it would be invisible.
  if (candidate.currency === subject.currency && subject.price > 0) {
    const delta = Math.abs(candidate.price - subject.price) / subject.price;
    if (delta <= PRICE_BRACKET) score += 2;
  }

  const shared = candidate.amenities.filter((a) => subject.amenities.includes(a)).length;
  score += Math.min(shared, 3);

  return score;
}

export function pickSimilar(subject: Property, pool: Property[], limit = 3): Property[] {
  return pool
    .map((candidate) => ({ candidate, score: similarityScore(subject, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.candidate.listedAt) - Date.parse(a.candidate.listedAt) ||
        a.candidate.reference.localeCompare(b.candidate.reference),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/**
 * Turn a title into an address segment.
 *
 * Used when the client creates a listing, so she does not have to invent a URL
 * — and only then. Once a listing exists its slug is hers to edit, because
 * renaming is a deliberate act with consequences (`property_slug_history`
 * remembers the old address so the links already published keep working, AC-5).
 * Re-deriving it from the title on every save would rename listings behind her
 * back, and every such rename retires an address.
 *
 * Accents are stripped rather than encoded: `Villa vue Atlas, Palmeraie` has to
 * become `villa-vue-atlas-palmeraie`, not `villa-vue-atlas-palmeraie` with a
 * percent-encoded é sitting in the middle of a URL an agent pastes into an
 * email. NFD splits a letter from its diacritic so the diacritic can be dropped.
 */
export function toSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
