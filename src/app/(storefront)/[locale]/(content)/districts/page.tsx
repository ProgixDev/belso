import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { getDictionary, interpolate } from "@/features/i18n";
import { countByDistrict, districtOrder, districts } from "@/features/properties";
import { SectionMasthead } from "../../_components/section-masthead";

/**
 * Where to look, before what to buy.
 *
 * Every agency at this level is asked the same first question — "which
 * neighbourhood?" — and answers it on the phone. Putting the answer on the site
 * is the cheapest content the storefront has: it is the only writing here that
 * is useful to someone who has not yet decided to buy anything, and it gives
 * every listing somewhere to point at other than the catalogue it came from.
 *
 * No `loading.tsx`: the districts are static data, so a skeleton would flash for
 * zero milliseconds while putting the route behind a Suspense boundary — which
 * is what turns a `notFound()` into a soft 200 (see the T2.8 note in tasks.md).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: dict.districts.title,
    description: dict.districts.lede,
    alternates: {
      canonical: toPublicPath("/districts", locale),
      languages: Object.fromEntries(
        locales.map((l) => [localeTag[l], toPublicPath("/districts", l)]),
      ),
    },
  };
}

export default async function DistrictsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const counts = await countByDistrict();

  return (
    <div className="container-page py-[clamp(40px,7vh,96px)]">
      <Reveal distance={12}>
        <SectionMasthead index="02" name={dict.districts.title} place={dict.districts.place} />
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mt-[clamp(28px,5vh,64px)] max-w-[30ch] text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.25] font-semibold tracking-[-0.015em]">
          {dict.districts.lede}
        </h1>
      </Reveal>

      <ul className="mt-[clamp(36px,6vh,80px)] grid gap-x-6 gap-y-[clamp(28px,4vh,48px)] sm:grid-cols-2 lg:grid-cols-3">
        {districtOrder.map((id, index) => {
          const district = districts[id];
          const copy = district.copy[locale];
          const count = counts[id];

          return (
            <Reveal as="li" key={id} delay={Math.min(index, 5) * 0.05}>
              {/*
               * Typographic, not photographic — see `districts.ts` for why the
               * stock pool cannot stand in for a place. The card carries its
               * own rule so ten of them read as a set rather than a wall.
               */}
              <Link
                href={toPublicPath(`/districts/${id}`, locale)}
                className="focus-visible:ring-ring border-border hover:border-foreground/40 group flex h-full flex-col gap-3 rounded-sm border-t pt-5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none motion-reduce:transition-none"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-foreground/30 font-serif text-[1.1rem] leading-none [font-variant-numeric:lining-nums]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-serif text-[clamp(1.5rem,2.4vw,2rem)] leading-none font-semibold">
                    {copy.name}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="bg-foreground/15 group-hover:bg-foreground/35 h-px min-w-4 flex-auto -translate-y-[0.3em] transition-colors motion-reduce:transition-none"
                  />
                </div>

                <p className="text-foreground/75 max-w-[42ch] text-[0.95rem] leading-[1.55]">
                  {copy.lede}
                </p>

                <span className="text-muted-foreground mt-auto pt-2 text-[10px] font-semibold tracking-[0.22em] uppercase">
                  {count === 0
                    ? dict.districts.countNone
                    : count === 1
                      ? dict.districts.countOne
                      : interpolate(dict.districts.count, { count: String(count) })}
                </span>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
