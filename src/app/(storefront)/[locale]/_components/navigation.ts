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

/** Header navigation. Kept short: this is chrome, not a sitemap. */
export function primaryNav(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { href: `/${locale}`, label: dict.nav.home },
    { href: toPublicPath("/properties", locale), label: dict.nav.properties },
    { href: toPublicPath("/contact", locale), label: dict.nav.contact },
  ];
}

/** Footer columns. A section with no live entries is not rendered at all. */
export function footerSections(
  locale: Locale,
  dict: Dictionary,
): { title: string; items: NavItem[] }[] {
  return [
    { title: dict.footer.sections.explore, items: primaryNav(locale, dict) },
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
