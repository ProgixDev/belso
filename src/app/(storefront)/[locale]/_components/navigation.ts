import { type Locale, toPublicPath } from "@/core/i18n";
import { type Dictionary, legalDocs } from "@/features/i18n";

/**
 * The one list of storefront destinations, shared by the header and the footer.
 *
 * AC-10 requires that every navigation item resolves to a real page, so an
 * entry belongs here **only once its route exists** — the criterion is verified
 * in Phase 4 by crawling exactly these links. Contact and the three legal
 * documents joined in Phase 3, alongside the routes themselves.
 */

export type NavItem = {
  href: string;
  label: string;
};

/**
 * Header navigation. Kept short: this is chrome, not a sitemap.
 *
 * Every entry is a route. The landing page used to add three more — `#about`,
 * `#residences`, `#amenities` — pointing at markers down the scene's scroll
 * runway. Those were not addresses: they could not be shared or indexed, they
 * meant nothing from any other page, and the header changed shape depending on
 * where you were standing. The beats they pointed at are now real pages.
 */
export function primaryNav(locale: Locale, dict: Dictionary): NavItem[] {
  return [...headerNav(locale, dict), contactAction(locale, dict)];
}

/**
 * What the header sets as links. Contact is not among them — it is the one
 * thing a visitor is being asked to do, so it is a button at the far right
 * rather than the fourth word in a row of four.
 *
 * The footer still lists all four through `primaryNav`, because there it is a
 * directory rather than a call to action, and AC-10 wants contact reachable
 * from the footer on every page.
 */
export function headerNav(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { href: `/${locale}`, label: dict.nav.home },
    { href: toPublicPath("/properties", locale), label: dict.nav.properties },
    { href: toPublicPath("/about", locale), label: dict.nav.about },
  ];
}

/** The header's one call to action. */
export function contactAction(locale: Locale, dict: Dictionary): NavItem {
  return { href: toPublicPath("/contact", locale), label: dict.nav.contact };
}

/**
 * Reachable, but not from the header.
 *
 * The header holds four items and no more: five puts the language switcher off
 * the right edge of a 390px screen, which is measured in `site-header.tsx` and
 * asserted in `e2e/home.spec.ts`. These two pages are real destinations that
 * lost the argument for that space — the neighbourhoods are entered from the
 * listings and the home page, selling from the footer and the home page.
 */
export function secondaryNav(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { href: toPublicPath("/districts", locale), label: dict.nav.districts },
    { href: toPublicPath("/sell", locale), label: dict.nav.sell },
  ];
}

/** Footer columns. A section with no live entries is not rendered at all. */
export function footerSections(
  locale: Locale,
  dict: Dictionary,
): { title: string; items: NavItem[] }[] {
  return [
    {
      title: dict.footer.sections.explore,
      items: [...primaryNav(locale, dict), ...secondaryNav(locale, dict)],
    },
    {
      title: dict.footer.sections.legal,
      // Derived from `legalDocs` rather than listed by hand, so adding a
      // document cannot leave the footer out of sync with the routes.
      items: legalDocs.map((doc) => ({
        href: toPublicPath(`/legal/${doc}`, locale),
        label: dict.legal[doc],
      })),
    },
  ].filter((section) => section.items.length > 0);
}
