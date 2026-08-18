import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { getDictionary } from "@/features/i18n";
import { SectionMasthead, SectionStatement } from "../../_components/section-masthead";

/**
 * The story at length — what the landing page's about sheet says in one screen.
 *
 * It exists because the navigation used to point at `#about`, a scroll position
 * inside the landing page's sticky stage. That is not an address: it cannot be
 * shared, indexed, or reached from any other page, and it broke outright from
 * every route that was not the home page.
 *
 * No `loading.tsx`: nothing here is fetched, so a skeleton would flash for zero
 * milliseconds while putting this route behind a Suspense boundary — which is
 * what turns a `notFound()` into a soft 200 (see the T2.8 note in tasks.md).
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
    title: dict.about.title,
    description: dict.about.lede,
    alternates: {
      canonical: toPublicPath("/about", locale),
      languages: Object.fromEntries(locales.map((l) => [localeTag[l], toPublicPath("/about", l)])),
    },
  };
}

/**
 * The same four photographs as the scene's about sheet, so the page and the
 * film are visibly the same place. Laid out as a plain band here rather than
 * the sheet's hanging composition — that composition is tuned to a fixed-height
 * stage, and this page is as long as its copy.
 *
 * Paths live here rather than coming from the scene slice: what that slice
 * exports is placement data for its own stage (column, span, height, reveal
 * delay), none of which means anything on a page that simply scrolls.
 */
const BAND = [
  { id: "facade", src: "/design/stock/grid-pool-dusk.jpg", aspect: "3/4" },
  { id: "walkway", src: "/design/stock/grid-courtyard.jpg", aspect: "3/4" },
  { id: "bedroom", src: "/design/stock/grid-stone-detail.jpg", aspect: "3/4" },
  { id: "terraces", src: "/design/stock/grid-terrace.jpg", aspect: "3/4" },
] as const;

/** One chapter. Statement left, prose on the eighth column — the sheet's grid. */
function Chapter({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border grid gap-x-6 gap-y-6 border-t py-[clamp(36px,6vh,72px)] md:grid-cols-12">
      <Reveal className="md:col-span-6">
        <SectionStatement>{title}</SectionStatement>
      </Reveal>
      <Reveal
        as="p"
        delay={0.1}
        className="text-foreground/80 max-w-[46ch] text-[1.02rem] leading-[1.65] md:col-span-5 md:col-start-8"
      >
        {body}
      </Reveal>
    </div>
  );
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <div className="container-page py-[clamp(40px,7vh,96px)]">
      <Reveal distance={12}>
        <SectionMasthead index="01" name={dict.about.title} place="Marrakech · Palmeraie" />
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mt-[clamp(28px,5vh,64px)] max-w-[22ch] text-[clamp(1.9rem,3.4vw,3.6rem)] leading-[1.05] font-bold tracking-[-0.025em]">
          {dict.about.lede}
        </h1>
      </Reveal>

      <ul className="mt-[clamp(32px,5vh,64px)] grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {BAND.map((frame, index) => (
          <Reveal
            as="li"
            key={frame.id}
            delay={index * 0.08}
            className="bg-muted relative overflow-hidden rounded-sm"
          >
            <div className="relative h-full w-full" style={{ aspectRatio: frame.aspect }}>
              <Image
                src={frame.src}
                alt={dict.home.scene.about.shots[frame.id]}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 22vw"
                priority={index < 2}
                className="object-cover"
              />
            </div>
          </Reveal>
        ))}
      </ul>

      <div className="mt-[clamp(36px,6vh,80px)]">
        <Chapter title={dict.about.storyTitle} body={dict.about.storyBody} />
        <Chapter title={dict.about.designTitle} body={dict.about.designBody} />
        <Chapter title={dict.about.groundsTitle} body={dict.about.groundsBody} />
        <Chapter title={dict.about.teamTitle} body={dict.about.teamBody} />
      </div>

      <div className="border-border flex flex-wrap gap-x-10 gap-y-4 border-t pt-[clamp(24px,4vh,48px)]">
        <Link
          href={toPublicPath("/properties", locale)}
          className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          {dict.properties.browseAll}
        </Link>
        <Link
          href={toPublicPath("/contact", locale)}
          className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          {dict.home.enquire.cta}
        </Link>
      </div>
    </div>
  );
}
