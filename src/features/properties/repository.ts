import "server-only";
import { cache } from "react";
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
import { loadBySlug, loadPublishedProperties, loadRetiredSlug } from "./row";
import { isDatabaseConfigured } from "@/core/db";
import type { LocalizedProperty, Property, PropertyQuery } from "./types";

/**
 * The seam between pages and wherever listings actually live.
 *
 * As of spec 010 that is Postgres on our own VPS (ADR-0008). The signatures
 * below did not change when it moved, which is the entire reason this module
 * exists rather than pages importing fixtures directly.
 *
 * **The rules the bodies below all obey, so nobody has to remember them:**
 *
 * 1. *Published only.* The filter lives in `row.ts`'s one `select`, not at the
 *    six callers here and certainly not at the pages above. AC-2 lists five
 *    entry points a draft must not appear at; a filter applied per-caller is a
 *    filter that gets missed at the sixth.
 * 2. *The database is the store; these functions are still the query engine.*
 *    `matchScore`, `sortProperties` and `pickSimilar` decide what a visitor
 *    sees, exactly as they did against fixtures. Re-expressing them in SQL is
 *    how "the same twenty properties, in the same order" quietly stops being
 *    true — `repository.golden.test.ts` exists to catch precisely that.
 *
 * `server-only` is the guard that keeps it honest: importing this from a client
 * component fails the build rather than quietly shipping the entire catalogue,
 * unpublished listings included, to the browser.
 */

/**
 * Fall back to the fixtures when no database is configured.
 *
 * Not a convenience — `pnpm verify` runs without a database, the production
 * build renders pages without one, and a contributor who has just cloned the
 * repository has neither Postgres nor the SSH key to tunnel to it. Any of those
 * failing would make the database a prerequisite for touching the front end.
 *
 * This is deliberately **not** the "database is down" path. That one is a real
 * failure with a visitor in front of it and it must say so (AC-5); this one is
 * a development environment that was never pointed at a database at all. The
 * two are different questions and `isDatabaseConfigured` is the one asked here.
 *
 * **Wrapped in React's `cache`, which is not an optimisation detail.** One
 * catalogue page calls `listProperties` and `countProperties`; a district page
 * adds `countByDistrict`; a listing page calls three more. Without per-request
 * memoisation each of those is a separate full read, so a single render costs
 * three to six round trips to fetch identical rows. `cache` collapses them to
 * one for the life of a request and, importantly, does **not** persist across
 * requests — a module-level cache here would serve one visitor a catalogue
 * assembled for another, and would keep serving a listing after the client
 * unpublished it.
 */
const catalogue = cache(async (): Promise<Property[]> => {
  return isDatabaseConfigured() ? loadPublishedProperties() : propertyFixtures;
});

/** Listings matching a visitor's words, ordered as they asked (AC-2, AC-3, AC-4). */
export async function listProperties({
  query = "",
  sort = defaultSort,
  district,
  locale,
}: PropertyQuery): Promise<LocalizedProperty[]> {
  const matched = (await catalogue()).filter(
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
  if (isDatabaseConfigured()) {
    const found = await loadBySlug(slug);
    return found ? localizeProperty(found, locale) : null;
  }

  const found = propertyFixtures.find((property) =>
    Object.values(property.translations).some((translation) => translation?.slug === slug),
  );

  return found ? localizeProperty(found, locale) : null;
}

/**
 * Where a retired address now lives, or `null` if it was never one of ours.
 *
 * The client can rename a listing from the back-office, and when she does,
 * every link we published and every message an agent sent still points at the
 * old slug. A 404 there is a lost enquiry, which on this site is the only thing
 * that actually matters — so the page redirects instead (AC-7).
 *
 * Returns the *current* slug in the locale the visitor asked for, not the one
 * the old address was recorded under: someone following a stale French link on
 * the English site should land on the English page, not be bounced across
 * languages on their way to a 200.
 */
export async function getCurrentSlugFor(
  retiredSlug: string,
  locale: Locale,
): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  const retired = await loadRetiredSlug(retiredSlug);
  if (!retired) return null;

  const slugs = await getLocaleSlugs(retiredSlug, retired.propertyId);
  return slugs[locale] ?? null;
}

/** The short row beneath a listing (AC-5). Empty only if the catalogue is. */
export async function getSimilar(
  id: string,
  locale: Locale,
  limit = 3,
): Promise<LocalizedProperty[]> {
  const all = await catalogue();
  const subject = all.find((property) => property.id === id);
  if (!subject) return [];

  return pickSimilar(subject, all, limit)
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
 *
 * `propertyId` is an optional shortcut for the redirect path, which already
 * knows which listing it resolved and would otherwise look it up by a slug the
 * listing no longer holds.
 */
export async function getLocaleSlugs(
  slug: string,
  propertyId?: string,
): Promise<Partial<Record<Locale, string>>> {
  const all = await catalogue();
  const found = propertyId
    ? all.find((property) => property.id === propertyId)
    : all.find((property) =>
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
  for (const property of await catalogue()) counts[property.districtId] += 1;
  return counts;
}

/** Total catalogue size, for the "browse everything" route out of an empty search (AC-4). */
export async function countProperties(): Promise<number> {
  return (await catalogue()).length;
}
