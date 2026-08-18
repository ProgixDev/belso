import "server-only";
import { type Locale, locales } from "@/core/i18n";
import { type DistrictId, districtIds } from "./districts";
import { propertyFixtures } from "./fixtures";
import {
  defaultSort,
  localizeProperty,
  matchScore,
  pickSimilar,
  resolveTranslation,
  sortProperties,
} from "./lib";
import type { LocalizedProperty, PropertyQuery } from "./types";

/**
 * The seam between pages and wherever listings actually live.
 *
 * Today that is `fixtures/`. Phase 2 replaces the bodies below with Supabase
 * queries and **nothing else moves** — that is the whole reason this module
 * exists rather than pages importing fixtures directly.
 *
 * `server-only` is the guard that keeps it honest: importing this from a client
 * component fails the build rather than quietly shipping the entire catalogue,
 * unpublished listings included, to the browser.
 */

/** Listings matching a visitor's words, ordered as they asked (AC-2, AC-3, AC-4). */
export async function listProperties({
  query = "",
  sort = defaultSort,
  district,
  locale,
}: PropertyQuery): Promise<LocalizedProperty[]> {
  const matched = propertyFixtures.filter(
    (property) =>
      (!district || property.districtId === district) && matchScore(property, query) > 0,
  );

  return sortProperties(matched, sort)
    .map((property) => localizeProperty(property, locale))
    .filter((property): property is LocalizedProperty => property !== null);
}

/**
 * One listing by the slug in the URL.
 *
 * Slugs are per-locale, so this searches *every* locale's slug rather than only
 * the requested one: a French URL shared into an English page must still
 * resolve, otherwise switching language on a detail page 404s (AC-1 + AC-5).
 */
export async function getPropertyBySlug(
  slug: string,
  locale: Locale,
): Promise<LocalizedProperty | null> {
  const found = propertyFixtures.find((property) =>
    Object.values(property.translations).some((translation) => translation?.slug === slug),
  );

  return found ? localizeProperty(found, locale) : null;
}

/** The short row beneath a listing (AC-5). Empty only if the catalogue is. */
export async function getSimilar(
  id: string,
  locale: Locale,
  limit = 3,
): Promise<LocalizedProperty[]> {
  const subject = propertyFixtures.find((property) => property.id === id);
  if (!subject) return [];

  return pickSimilar(subject, propertyFixtures, limit)
    .map((property) => localizeProperty(property, locale))
    .filter((property): property is LocalizedProperty => property !== null);
}

/**
 * One listing's address in every language, keyed by locale.
 *
 * `LocalizedProperty` cannot answer this — it is resolved for exactly one
 * language and carries exactly one slug — which is how the detail page came to
 * declare its `hreflang` alternates using the *current* locale's slug for all
 * of them. The URL still resolved, so nothing looked broken; but it pointed at
 * a page whose own canonical was a different address, which is the shape of
 * hreflang cluster a crawler discards entirely.
 *
 * A locale with no translation of its own falls back (AC-9), and the fallback
 * slug is genuinely where that page lives, so it is the right answer rather
 * than an omission.
 */
export async function getLocaleSlugs(slug: string): Promise<Partial<Record<Locale, string>>> {
  const found = propertyFixtures.find((property) =>
    Object.values(property.translations).some((translation) => translation?.slug === slug),
  );
  if (!found) return {};

  return Object.fromEntries(
    locales
      .map((locale) => [locale, resolveTranslation(found, locale)?.slug] as const)
      .filter(([, resolved]) => Boolean(resolved)),
  );
}

/**
 * How many listings each district holds, for the district index.
 *
 * Every district is present in the result even at zero — a district page that
 * exists but is missing from its own index is a dead end a visitor can reach
 * from a listing and then never find again.
 */
export async function countByDistrict(): Promise<Record<DistrictId, number>> {
  const counts = Object.fromEntries(districtIds.map((id) => [id, 0])) as Record<DistrictId, number>;
  for (const property of propertyFixtures) counts[property.districtId] += 1;
  return counts;
}

/** Total catalogue size, for the "browse everything" route out of an empty search (AC-4). */
export async function countProperties(): Promise<number> {
  return propertyFixtures.length;
}
