import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { EnquiryForm } from "@/features/enquiries";
import { propertyCardLabels } from "../../../_components/property-labels";
import { getDictionary } from "@/features/i18n";
import { enquiryLabels } from "../../../_components/enquiry-labels";
import {
  Gallery,
  getLocaleSlugs,
  getPropertyBySlug,
  getSimilar,
  KeyFacts,
  ListingJsonLd,
  Price,
  PropertyCard,
} from "@/features/properties";

/**
 * The listing detail.
 *
 * **This route deliberately ships no `loading.tsx`.** A `loading.tsx` anywhere
 * on the path to a route that calls `notFound()` wraps it in Suspense, so the
 * shell streams with a 200 before the throw and the status can never be
 * corrected — an unknown slug then returns a soft 404 that search engines
 * happily index (AC-8, and "référencement +++" is a stated priority). Verified
 * both ways: with an ancestor `loading.tsx` the response is 200, without it 404.
 *
 * The listings page keeps its skeleton because it sits in the `(index)` group,
 * which does not wrap this segment. If this page ever gets slow enough to want
 * streaming, put a `<Suspense>` *inside* it around the slow part — below the
 * `notFound()` decision — rather than reintroducing `loading.tsx` above it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const property = await getPropertyBySlug(slug, locale);
  if (!property) return {};

  /*
   * Each language's own slug, not this one's repeated. The French page used to
   * announce its English alternate as `/en/properties/villa-vue-atlas-palmeraie`
   * — an address that resolves but whose canonical is
   * `/en/properties/atlas-view-villa-palmeraie`. An hreflang pointing at a page
   * that names a different canonical is a cluster a crawler throws away, and it
   * also put this page at odds with `sitemap.ts`, which had it right.
   */
  const slugs = await getLocaleSlugs(slug);

  return {
    title: property.title,
    // The listing's own words, trimmed — a description repeated from the site
    // tagline on every listing is worth nothing to a search engine.
    description: property.description.replace(/\s+/g, " ").slice(0, 155),
    alternates: {
      canonical: toPublicPath(`/properties/${property.slug}`, locale),
      languages: Object.fromEntries(
        locales.map((l) => [
          localeTag[l],
          toPublicPath(`/properties/${slugs[l] ?? property.slug}`, l),
        ]),
      ),
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const property = await getPropertyBySlug(slug, locale);
  if (!property) notFound();

  const dict = getDictionary(locale);
  const similar = await getSimilar(property.id, locale);

  const statusLabel =
    property.status === "underOffer"
      ? dict.properties.statusUnderOffer
      : property.status === "sold"
        ? dict.properties.statusSold
        : property.status === "rented"
          ? dict.properties.statusRented
          : null;

  const cardLabels = propertyCardLabels(dict);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <ListingJsonLd
        property={property}
        path={toPublicPath(`/properties/${property.slug}`, locale)}
        labels={{ landArea: dict.properties.landArea, amenity: dict.amenity }}
      />

      <nav aria-label={dict.properties.title} className="mb-8">
        <Link
          href={toPublicPath("/properties", locale)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          ← {dict.properties.backToProperties}
        </Link>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          <Gallery
            media={property.media}
            locale={locale}
            labels={{
              gallery: dict.properties.gallery,
              previous: dict.properties.previousPhoto,
              next: dict.properties.nextPhoto,
              photoOf: dict.properties.photoOf,
            }}
          />

          <Reveal>
            <section aria-labelledby="description-heading" className="flex flex-col gap-4">
              <h2 id="description-heading" className="text-lg font-semibold tracking-tight">
                {dict.properties.description}
              </h2>

              {property.isFallback ? (
                /*
                 * AC-9. `lang` on the wrapper matters as much as the note: without
                 * it a screen reader reads French prose with an English voice,
                 * which is unintelligible rather than merely untranslated.
                 */
                <p
                  role="note"
                  className="border-border bg-muted/50 text-muted-foreground rounded-md border px-4 py-3 text-sm"
                >
                  {dict.properties.untranslated}
                </p>
              ) : null}

              <div
                lang={property.isFallback ? localeTag[property.textLocale] : undefined}
                className="flex flex-col gap-4 text-sm leading-relaxed"
              >
                {property.description.split("\n\n").map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          </Reveal>

          {property.amenities.length > 0 ? (
            <Reveal>
              <section aria-labelledby="amenities-heading" className="flex flex-col gap-4">
                <h2 id="amenities-heading" className="text-lg font-semibold tracking-tight">
                  {dict.properties.amenities}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity) => (
                    <li key={amenity}>
                      <Badge variant="outline">{dict.amenity[amenity]}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {property.kind === "rent" ? dict.properties.forRent : dict.properties.forSale}
              </Badge>
              {statusLabel ? <Badge>{statusLabel}</Badge> : null}
            </div>

            <h1 className="font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight">
              {property.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {/* The strongest internal link the site has: every listing points
               * at the writing about where it stands, and that page points back
               * at the listings around it. */}
              <Link
                href={toPublicPath(`/districts/${property.districtId}`, locale)}
                className="focus-visible:ring-ring hover:text-foreground rounded-sm underline decoration-current/30 underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                {property.district}
              </Link>
              , {property.city}
            </p>
          </div>

          <Price property={property} locale={locale} perMonthLabel={dict.properties.perMonth} />

          <section aria-labelledby="facts-heading">
            <h2 id="facts-heading" className="sr-only">
              {dict.properties.keyFacts}
            </h2>
            <KeyFacts
              property={property}
              locale={locale}
              labels={{
                reference: dict.properties.referenceLabel,
                type: dict.properties.type,
                typeLabel: dict.propertyType[property.type],
                bedrooms: dict.properties.bedrooms,
                bathrooms: dict.properties.bathrooms,
                builtArea: dict.properties.builtArea,
                landArea: dict.properties.landArea,
              }}
            />
          </section>
        </aside>
      </div>

      {/*
       * AC-6: the form already knows which property this is. It sits after the
       * description and before the similar row — a visitor convinced by what
       * they just read should not have to scroll past four other listings to
       * act on it.
       */}
      <Reveal>
        <section aria-labelledby="enquiry-heading" className="mt-20 max-w-2xl">
          <h2 id="enquiry-heading" className="sr-only">
            {dict.enquiry.title}
          </h2>
          <EnquiryForm
            labels={enquiryLabels(dict, {
              reference: property.reference,
              subject: property.title,
            })}
            reference={property.reference}
            subject={property.title}
          />
        </section>
      </Reveal>

      {similar.length > 0 ? (
        <Reveal>
          <section aria-labelledby="similar-heading" className="mt-20">
            <h2 id="similar-heading" className="text-lg font-semibold tracking-tight">
              {dict.properties.similar}
            </h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => (
                <li key={item.id}>
                  <PropertyCard
                    property={item}
                    locale={locale}
                    labels={{ ...cardLabels, type: dict.propertyType[item.type] }}
                  />
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ) : null}
    </div>
  );
}
