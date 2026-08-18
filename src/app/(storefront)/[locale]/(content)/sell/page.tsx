import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion";
import { isLocale, localeTag, locales, toPublicPath } from "@/core/i18n";
import { EnquiryForm } from "@/features/enquiries";
import { getDictionary } from "@/features/i18n";
import { enquiryLabels } from "../../_components/enquiry-labels";
import { SectionMasthead, SectionStatement } from "../../_components/section-masthead";

/**
 * The other half of an agency, and the half the site did not have.
 *
 * Everything else here speaks to someone buying. An owner arriving with a villa
 * to sell had no page that spoke to them, no idea what the agency does for its
 * fee, and no route to a conversation except the general contact form.
 *
 * It is not in the header: four items is what a 390px screen holds without the
 * language switcher falling off the edge (measured — see `site-header.tsx`).
 * It is reachable from the footer and from the home page instead.
 *
 * No `loading.tsx`, for the reason every content route here ships without one:
 * a Suspense boundary above a `notFound()` turns a hard 404 into a soft 200.
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
    title: dict.sell.title,
    description: dict.sell.lede,
    alternates: {
      canonical: toPublicPath("/sell", locale),
      languages: Object.fromEntries(locales.map((l) => [localeTag[l], toPublicPath("/sell", l)])),
    },
  };
}

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <div className="container-page py-[clamp(40px,7vh,96px)]">
      <Reveal distance={12}>
        <SectionMasthead index="05" name={dict.sell.title} place={dict.sell.place} />
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mt-[clamp(28px,5vh,64px)] max-w-[22ch] text-[clamp(1.9rem,3.4vw,3.6rem)] leading-[1.05] font-bold tracking-[-0.025em]">
          {dict.sell.lede}
        </h1>
      </Reveal>

      <div className="border-border mt-[clamp(36px,6vh,80px)] grid gap-x-6 gap-y-6 border-t py-[clamp(36px,6vh,72px)] md:grid-cols-12">
        <Reveal className="md:col-span-6">
          <SectionStatement>{dict.sell.statement}</SectionStatement>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-4 md:col-span-5 md:col-start-8">
          {dict.sell.body.split("\n\n").map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="text-foreground/80 max-w-[46ch] text-[1.02rem] leading-[1.65]"
            >
              {paragraph}
            </p>
          ))}
        </Reveal>
      </div>

      <section
        aria-labelledby="sell-steps"
        className="border-border border-t pt-[clamp(28px,4vh,56px)]"
      >
        <h2 id="sell-steps" className="text-lg font-semibold tracking-tight">
          {dict.sell.stepsTitle}
        </h2>

        <ol className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {dict.sell.steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={Math.min(index, 3) * 0.06}>
              <p
                aria-hidden="true"
                className="text-foreground/30 font-serif text-[1.6rem] leading-none font-medium [font-variant-numeric:lining-nums]"
              >
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-serif text-[1.35rem] leading-none font-semibold">
                {step.title}
              </h3>
              <p className="text-foreground/75 mt-3 max-w-[46ch] text-[0.98rem] leading-[1.6]">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="sell-enquiry"
        className="border-border mt-[clamp(40px,7vh,96px)] max-w-2xl border-t pt-[clamp(28px,4vh,56px)]"
      >
        <Reveal>
          <h2 id="sell-enquiry" className="text-lg font-semibold tracking-tight">
            {dict.sell.formTitle}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-[52ch] text-sm">{dict.sell.formLede}</p>
        </Reveal>

        <Reveal delay={0.1}>
          {/*
           * The same painted-door form as everywhere else, with the page's own
           * subject so the confirmation names what was actually sent rather
           * than the generic wording (AC-6).
           */}
          <EnquiryForm
            labels={enquiryLabels(dict, { subject: dict.sell.title })}
            className="mt-8"
          />
        </Reveal>
      </section>

      <div className="border-border mt-[clamp(40px,7vh,96px)] flex flex-wrap gap-x-10 gap-y-4 border-t pt-[clamp(24px,4vh,48px)]">
        <Link
          href={toPublicPath("/districts", locale)}
          className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          {dict.districts.backToDistricts}
        </Link>
        <Link
          href={toPublicPath("/properties", locale)}
          className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          {dict.properties.browseAll}
        </Link>
      </div>
    </div>
  );
}
