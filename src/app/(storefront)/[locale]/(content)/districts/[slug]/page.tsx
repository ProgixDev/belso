import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { propertyCardLabels } from "../../../_components/property-labels";
import { getDictionary } from "@/features/i18n";
import {
  districtIds,
  districtOrder,
  districts,
  isDistrictId,
  listProperties,
  PropertyCard,
} from "@/features/properties";
import { SectionMasthead } from "../../../_components/section-masthead";

/**
 * One neighbourhood: what it is, what to watch for, and what we have in it.
 *
 * The slug is the same in both languages — `Palmeraie` is `Palmeraie` — so this
 * route needs none of the cross-locale slug resolution the listings do. That is
 * a deliberate simplification recorded in `features/properties/districts.ts`,
 * not an oversight.
 *
 * No `loading.tsx`, for the reason every content route here ships without one:
 * a Suspense boundary above a `notFound()` turns a hard 404 into a soft 200.
 */

export function generateStaticParams() {
  return locales.flatMap((locale) => districtIds.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isDistrictId(slug)) return {};
  const copy = districts[slug].copy[locale];

  return {
    title: copy.name,
    description: copy.lede,
    alternates: {
      canonical: toPublicPath(`/districts/${slug}`, locale),
      languages: Object.fromEntries(
        locales.map((l) => [localeTag[l], toPublicPath(`/districts/${slug}`, l)]),
      ),
    },
  };
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  // An unknown neighbourhood is a 404, not an empty page with a heading.
  if (!isDistrictId(slug)) notFound();

  const dict = getDictionary(locale);
  const copy = districts[slug].copy[locale];
  const listings = await listProperties({ district: slug, locale });
  const elsewhere = districtOrder.filter((id) => id !== slug).slice(0, 4);

  const cardLabels = propertyCardLabels(dict);

  return (
    <div className="container-page py-[clamp(40px,7vh,96px)]">
      <nav aria-label={dict.districts.title} className="mb-8">
        <Link
          href={toPublicPath("/districts", locale)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          ← {dict.districts.backToDistricts}
        </Link>
      </nav>

      <Reveal distance={12}>
        <SectionMasthead
          index={String(districtOrder.indexOf(slug) + 1).padStart(2, "0")}
          name={copy.name}
          place={dict.districts.place}
        />
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mt-[clamp(28px,5vh,64px)] max-w-[24ch] text-[clamp(1.9rem,3.4vw,3.6rem)] leading-[1.05] font-bold tracking-[-0.025em]">
          {copy.lede}
        </h1>
      </Reveal>

      {/*
       * No photograph here either (`districts.ts` says why), so the writing is
       * set in two columns at reading measure rather than one narrow column
       * beside an empty half.
       */}
      <div className="border-border mt-[clamp(36px,6vh,80px)] grid gap-x-12 gap-y-6 border-t pt-[clamp(28px,4vh,56px)] md:grid-cols-2">
        {copy.body.split("\n\n").map((paragraph, index) => (
          <Reveal
            as="p"
            key={paragraph.slice(0, 40)}
            delay={Math.min(index, 3) * 0.06}
            className="text-foreground/80 max-w-[46ch] text-[1.02rem] leading-[1.65]"
          >
            {paragraph}
          </Reveal>
        ))}
      </div>

      <section
        aria-labelledby="district-listings"
        className="border-border mt-[clamp(40px,7vh,96px)] border-t pt-[clamp(28px,4vh,56px)]"
      >
        <h2 id="district-listings" className="text-lg font-semibold tracking-tight">
          {dict.districts.listingsHere}
        </h2>

        {listings.length > 0 ? (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((property, index) => (
              <Reveal as="li" key={property.id} delay={Math.min(index, 5) * 0.05}>
                <PropertyCard
                  property={property}
                  locale={locale}
                  labels={{ ...cardLabels, type: dict.propertyType[property.type] }}
                />
              </Reveal>
            ))}
          </ul>
        ) : (
          /* AC-4's rule applied here too: never a bare empty grid. */
          <div className="mt-6 flex flex-col items-start gap-4">
            <p className="text-muted-foreground max-w-[52ch] text-sm">{dict.districts.empty}</p>
            <Link
              href={toPublicPath("/contact", locale)}
              className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
            >
              {dict.home.enquire.cta}
            </Link>
          </div>
        )}
      </section>

      <section
        aria-labelledby="district-elsewhere"
        className="border-border mt-[clamp(40px,7vh,96px)] border-t pt-[clamp(24px,4vh,48px)]"
      >
        <h2 id="district-elsewhere" className="text-lg font-semibold tracking-tight">
          {dict.districts.otherDistricts}
        </h2>
        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {elsewhere.map((id) => (
            <li key={id}>
              <Link
                href={toPublicPath(`/districts/${id}`, locale)}
                className="focus-visible:ring-ring rounded-sm font-serif text-[1.15rem] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
              >
                {districts[id].copy[locale].name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
