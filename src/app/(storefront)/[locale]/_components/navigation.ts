import { type Locale, toPublicPath } from "@/core/i18n";
import type { Dictionary } from "@/features/i18n";

/**
 * The one list of storefront destinations, shared by the header and the footer.
 *
 * AC-10 requires that every navigation item resolves to a real page, so an
 * entry belongs here **only once its route exists**. Contact and the three
 * legal documents are Phase 3 (T3.4, T3.5) and are deliberately absent until
 * then — a footer that links to a 404 is worse than a short footer, and the
 * criterion is verified by crawling these links in Phase 4.
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
  ];
}

/** Footer columns. Sections with no live entries are not rendered at all. */
export function footerSections(
  locale: Locale,
  dict: Dictionary,
): { title: string; items: NavItem[] }[] {
  return [{ title: dict.footer.sections.explore, items: primaryNav(locale, dict) }].filter(
    (section) => section.items.length > 0,
  );
}
