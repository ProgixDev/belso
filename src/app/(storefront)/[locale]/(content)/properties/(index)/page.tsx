import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/empty-state";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { mapLabels, propertyCardLabels } from "../../../_components/property-labels";
import { getDictionary, interpolate } from "@/features/i18n";
import {
  districtOrder,
  districts,
  listProperties,
  propertySearchParamsSchema,
  PropertyCard,
  PropertyMap,
  ResultsHeader,
  SortControl,
} from "@/features/properties";
import { mapStyles } from "@/core/env.client";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Rendered per request, because this page reads the catalogue.
 *
 * The build already reports this route as dynamic, so today this line changes
 * nothing — and that is the reason to write it down rather than to leave it
 * out. It is currently dynamic by *inference*: Next works it out from what the
 * tree happens to do, and an edit that removes the last dynamic API from the
 * page would silently turn the catalogue back into a build-time snapshot. That
 * is exactly the failure spec 010's review found on the home page and the
 * sitemap, where a listing the client had archived kept being served until
 * somebody redeployed. Every other catalogue-reading route states this
 * explicitly; these two were missed.
 *
 * The cheaper answer is `revalidate` plus `revalidatePath` from the back-office
 * write path — which now exists (`admin-actions.ts`), so this can be revisited
 * deliberately rather than by accident.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; sort?: string; view?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  // Every page below the locale root must set its own canonical, or it inherits
  // the layout's `/fr` and the whole storefront collapses to one URL (T1.7a note).
  return {
    title: dict.properties.title,
    alternates: {
      canonical: toPublicPath("/properties", locale),
      languages: Object.fromEntries(
        locales.map((l) => [localeTag[l], toPublicPath("/properties", l)]),
      ),
    },
  };
}

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  // SEC-INPUT-001: the query string is a trust boundary. `catch` on both fields
  // means a stale link with a dead `?sort=` degrades to the default instead of
  // throwing a 500 at the visitor.
  const { q: query, sort, view } = propertySearchParamsSchema.parse(await searchParams);

  const properties = await listProperties({ query, sort, locale });
  const listingsHref = toPublicPath("/properties", locale);
  const cardLabels = propertyCardLabels(dict);

  /** Keeps `q` and `sort` when flipping the view — losing the search would be worse than losing the view. */
  const hrefForView = (target: "grid" | "map") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "newest") params.set("sort", sort);
    if (target === "map") params.set("view", "map");
    const search = params.toString();
    return search ? `${listingsHref}?${search}` : listingsHref;
  };

  const count =
    properties.length === 1
      ? dict.properties.resultCountOne
      : interpolate(dict.properties.resultCount, { count: formatCount(properties.length, locale) });

  return (
    /*
     * Edge to edge and four across, aligned to the frame the header sits in
     * rather than centred in a reading column. A catalogue page is not prose:
     * the question it answers is how much there is, and a 1280px column on a
     * 1920px screen answers it with three cards and a lot of paper.
     */
    <div className="container-bleed py-[clamp(20px,3vh,36px)]">
      <ResultsHeader
        title={dict.properties.title}
        count={count}
        query={query || undefined}
        searchedForLabel={dict.properties.searchedFor}
        clearLabel={dict.properties.clearSearch}
        clearHref={listingsHref}
        viewToggle={
          /* A real link, so it works before JavaScript arrives and after it fails. */
          <Link
            href={view === "map" ? hrefForView("grid") : hrefForView("map")}
            className="focus-visible:ring-ring border-border hover:border-foreground/40 rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            {view === "map" ? dict.map.showList : dict.map.showMap}
          </Link>
        }
        sortControl={
          <SortControl
            value={sort}
            label={dict.properties.sortLabel}
            applyLabel={dict.properties.apply}
            optionLabels={{
              newest: dict.properties.sortNewest,
              priceAsc: dict.properties.sortPriceAsc,
              priceDesc: dict.properties.sortPriceDesc,
            }}
          />
        }
      />

      {/*
       * The way into the neighbourhood writing. It sits here rather than in the
       * header because the header holds four items before the language switcher
       * falls off a phone — and because "which neighbourhood?" is a question
       * someone asks while looking at a grid, not before they arrive.
       */}
      <Reveal as="nav" delay={0.05} className="mt-8" aria-label={dict.districts.title}>
        <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <li className="text-muted-foreground text-[10px] font-semibold tracking-[0.22em] uppercase">
            {dict.districts.label}
          </li>
          {districtOrder.map((id) => (
            <li key={id}>
              <Link
                href={toPublicPath(`/districts/${id}`, locale)}
                className="focus-visible:ring-ring rounded-sm font-serif text-[1.05rem] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
              >
                {districts[id].copy[locale].name}
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>

      {view === "map" && properties.length > 0 ? (
        <div className="mt-8">
          <PropertyMap
            properties={properties}
            locale={locale}
            labels={mapLabels(dict)}
            cardLabels={cardLabels}
            typeLabels={dict.propertyType}
            listHref={hrefForView("grid")}
            styles={mapStyles}
          />
          {/*
           * The map is WebGL and cannot exist without JavaScript, so the view
           * still has to answer the question it was opened for. `next/dynamic`
           * renders nothing on the server, which is exactly the hole this fills.
           */}
          <noscript>
            <p className="text-muted-foreground mt-6 text-sm">{dict.map.noScript}</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {properties.map((property) => (
                <li key={property.id}>
                  <PropertyCard
                    property={property}
                    locale={locale}
                    labels={{ ...cardLabels, type: dict.propertyType[property.type] }}
                  />
                </li>
              ))}
            </ul>
          </noscript>
        </div>
      ) : properties.length === 0 ? (
        // AC-4: never a bare empty grid — say so, and offer the way out.
        <EmptyState
          className="py-24"
          title={dict.properties.emptyTitle}
          description={dict.properties.emptyBody}
          action={
            <Link href={listingsHref} className={cn(buttonVariants({ variant: "default" }))}>
              {dict.properties.browseAll}
            </Link>
          }
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((property, index) => (
            // The stagger is capped: past the first two rows the delay stops
            // growing, or the twentieth card would wait two seconds to appear.
            <Reveal as="li" key={property.id} delay={Math.min(index, 5) * 0.07}>
              <PropertyCard
                property={property}
                locale={locale}
                priority={index < 3}
                labels={{ ...cardLabels, type: dict.propertyType[property.type] }}
              />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
