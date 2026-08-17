import { convert, displayCurrency } from "@/core/currency";
import { defaultLocale, type Locale } from "@/core/i18n";
import type { LocalizedProperty, Property, PropertySort, PropertyTranslation } from "./types";

/**
 * The pure half of the properties slice: resolving translations, matching a
 * visitor's words, ordering, and scoring similarity. No I/O, no `server-only` —
 * `repository.ts` composes these, and they are directly unit-testable, which is
 * how AC-3 and AC-9 are proven without a browser.
 */

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
    kind: property.kind,
    type: property.type,
    status: property.status,
    price: property.price,
    currency: property.currency,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    builtArea: property.builtArea,
    landArea: property.landArea,
    amenities: property.amenities,
    media: property.media,
    listedAt: property.listedAt,
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
