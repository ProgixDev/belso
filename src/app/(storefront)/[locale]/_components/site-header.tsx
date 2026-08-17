import Link from "next/link";
import type { Locale } from "@/core/i18n";
import { type Dictionary, LocaleSwitcher } from "@/features/i18n";
import { primaryNav } from "./navigation";

/**
 * Storefront chrome for every page **except** the home scene, which supplies its
 * own header staggered in by the splash animation. Putting a second header above
 * that one would double the navigation and break the intro (T1.7 note).
 */
export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="border-border/60 bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md">
      {/* First tab stop on every page: keyboard users should not wade through the nav (AC-11). */}
      <a
        href="#main"
        className="bg-background text-foreground focus-visible:ring-ring sr-only px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:ring-2"
      >
        {dict.nav.skipToContent}
      </a>

      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href={`/${locale}`}
          className="text-foreground font-[family-name:var(--font-archivo)] text-lg font-extrabold tracking-[0.18em] uppercase"
        >
          Belso
        </Link>

        <nav aria-label={dict.nav.menu} className="flex items-center gap-6">
          {primaryNav(locale, dict).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-xs font-semibold tracking-[0.16em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LocaleSwitcher locale={locale} label={dict.locale.label} />
      </div>
    </header>
  );
}
