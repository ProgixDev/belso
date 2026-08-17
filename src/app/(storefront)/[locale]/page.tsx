import { notFound } from "next/navigation";
import { isLocale, toPublicPath } from "@/core/i18n";
import { CinematicScroll } from "@/features/cinematic-scroll";
import { getDictionary } from "@/features/i18n";
import { SiteFooter } from "./_components/site-footer";
import { primaryNav, sceneNav } from "./_components/navigation";
import { SiteHeader } from "./_components/site-header";

/**
 * The landing page composes the shared chrome around the scene rather than
 * letting the scene supply its own.
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

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
       * The landing header carries the scene's own beats alongside the site
       * links — those anchors are the only way to reach the About, Residences
       * and Amenities moments, which are scroll states rather than routes.
       */}
      <SiteHeader
        locale={locale}
        dict={dict}
        overlay
        items={[...sceneNav(dict), ...primaryNav(locale, dict).slice(1)]}
      />

      <CinematicScroll
        search={{
          action: toPublicPath("/properties", locale),
          label: dict.home.searchLabel,
          placeholder: dict.home.searchPlaceholder,
          submitLabel: dict.home.searchSubmit,
        }}
      />

      {/* Contact and the legal documents must be reachable from every page,
       * including this one (AC-10) — the scene alone offered no route to them. */}
      <SiteFooter locale={locale} dict={dict} />
    </div>
  );
}
