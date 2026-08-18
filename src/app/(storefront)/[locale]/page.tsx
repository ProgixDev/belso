import { notFound } from "next/navigation";
import { isLocale, toPublicPath } from "@/core/i18n";
import { CinematicScroll } from "@/features/cinematic-scroll";
import { getDictionary } from "@/features/i18n";
import { listProperties } from "@/features/properties";
import { EnquireSection, GroundsSection, ResidencesSection } from "./_components/home-sections";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

/** How many listings the residences section puts on the shelf. One row. */
const SHELF_SIZE = 3;

/**
 * The landing page: the film, then three doorways.
 *
 * The scene used to be the whole page — six beats over a 6600px runway, with
 * "residences" and "amenities" as scroll positions rather than places. It is
 * now two beats that end on the about sheet, and everything after it is
 * ordinary content in ordinary document flow, each section opening a real page.
 *
 * It does not reuse `PageShell` (which the `(content)` group applies) for one
 * reason: the header here is the `overlay` variant, transparent over the hero
 * until the visitor scrolls. Everything else — the same header, the same
 * footer, the `#main` landmark — matches every other page, which is the point.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  // Newest first, which is `defaultSort` — the shelf should show what just
  // arrived, not the same three properties for a year.
  const shelf = (await listProperties({ locale })).slice(0, SHELF_SIZE);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} dict={dict} overlay />

      <main id="main">
        <CinematicScroll
          copy={dict.home.scene}
          search={{
            action: toPublicPath("/properties", locale),
            label: dict.home.searchLabel,
            placeholder: dict.home.searchPlaceholder,
            submitLabel: dict.home.searchSubmit,
            hint: dict.home.searchHint,
          }}
        />

        <ResidencesSection
          locale={locale}
          dict={dict}
          properties={shelf}
          href={toPublicPath("/properties", locale)}
          districtsHref={toPublicPath("/districts", locale)}
        />
        <GroundsSection dict={dict} href={toPublicPath("/about", locale)} />
        <EnquireSection dict={dict} href={toPublicPath("/contact", locale)} />
      </main>

      {/* Contact and the legal documents must be reachable from every page,
       * including this one (AC-10) — the scene alone offered no route to them. */}
      <SiteFooter locale={locale} dict={dict} />
    </div>
  );
}
