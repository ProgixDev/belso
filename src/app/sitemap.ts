import type { MetadataRoute } from "next";
import { type Locale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { site } from "@/core/site";
import { districtIds, listProperties } from "@/features/properties";

/**
 * Every public page, in every locale, with its translations declared alongside.
 *
 * Two things this file is careful about:
 *
 * **It is localised.** A bilingual site whose sitemap lists one URL has told a
 * crawler that one page exists. Each entry therefore carries `alternates.languages`
 * with the same `hreflang` keys the pages themselves emit in their metadata, so
 * the two sources agree — a sitemap that contradicts the page it describes is
 * worse than no sitemap.
 *
 * **The legal pages are deliberately absent.** They are `robots: noindex` while
 * the copy is a placeholder (`dictionaries/legal.ts`), and asking to be indexed
 * here while refusing it there is exactly the kind of mixed signal that gets a
 * whole site trusted less. They come back in the commit that brings real text.
 *
 * `/account`, `/sign-in` and `/examples` are out for the ordinary reason: they
 * are not public content.
 */

const absolute = (path: string) => `${site.url}${path}`;

/**
 * Pages that exist once per locale at a fixed address.
 *
 * No `lastModified`: it would be build time, which changes on every deploy and
 * would tell a crawler the whole site was rewritten because a button colour
 * moved. Listings below carry a real date, because they have one.
 */
const STATIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/properties", changeFrequency: "daily", priority: 0.9 },
  { path: "/districts", changeFrequency: "monthly", priority: 0.8 },
  { path: "/sell", changeFrequency: "yearly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
] as const satisfies readonly {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[];

/** The `hreflang` map for one internal path that reads the same in every locale. */
function sharedAlternates(path: string) {
  return {
    languages: Object.fromEntries(
      locales.map((locale) => [localeTag[locale], absolute(toPublicPath(path, locale))]),
    ),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * Once per locale, because slugs are translated: the same listing is
   * `/fr/biens/villa-vue-atlas-palmeraie` and `/en/properties/atlas-view-villa-palmeraie`.
   * Collecting all of them first is what lets each entry point at its siblings.
   */
  const catalogue = await Promise.all(
    locales.map(async (locale) => [locale, await listProperties({ locale })] as const),
  );

  const slugsById = new Map<string, Partial<Record<Locale, string>>>();
  for (const [locale, listings] of catalogue) {
    for (const property of listings) {
      slugsById.set(property.id, { ...slugsById.get(property.id), [locale]: property.slug });
    }
  }

  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    STATIC_ROUTES.map((route) => ({
      url: absolute(toPublicPath(route.path, locale)),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: sharedAlternates(route.path),
    })),
  );

  /*
   * District slugs are not translated — `Palmeraie` is `Palmeraie` — so these
   * need none of the per-locale slug correlation the listings below do.
   */
  const districtEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    districtIds.map((id) => ({
      url: absolute(toPublicPath(`/districts/${id}`, locale)),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: sharedAlternates(`/districts/${id}`),
    })),
  );

  const listingEntries: MetadataRoute.Sitemap = catalogue.flatMap(([locale, listings]) =>
    listings.map((property) => {
      const slugs = slugsById.get(property.id) ?? {};
      return {
        url: absolute(toPublicPath(`/properties/${property.slug}`, locale)),
        // The day the listing went up. Republished on edit once listings come
        // from the database rather than fixtures.
        lastModified: property.listedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((other) => [
              localeTag[other],
              // A listing with no text in `other` still has a page there — it
              // falls back to the language it was written in (AC-9), keeping
              // its original slug. Pointing at that is correct; omitting the
              // alternate would claim the page does not exist.
              absolute(toPublicPath(`/properties/${slugs[other] ?? property.slug}`, other)),
            ]),
          ),
        },
      };
    }),
  );

  return [...staticEntries, ...districtEntries, ...listingEntries];
}
