import type { Locale } from "@/core/i18n";
import type { Dictionary } from "@/features/i18n";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Header + main + footer, for every storefront page that is not the home scene.
 *
 * `<main id="main">` is what the header's skip link targets, so it lives here
 * rather than in each page — a page that forgot it would silently break
 * keyboard navigation (AC-11) while looking completely normal.
 *
 * Width and padding are the page's business, not the shell's: a listings grid
 * and a legal document want different measures.
 */
export function PageShell({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} dict={dict} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </div>
  );
}
