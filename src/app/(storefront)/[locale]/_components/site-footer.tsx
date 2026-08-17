import Link from "next/link";
import type { Locale } from "@/core/i18n";
import type { Dictionary } from "@/features/i18n";
import { site } from "@/core/site";
import { footerSections } from "./navigation";

/**
 * Storefront footer. Contact and the legal documents join `navigation.ts` in
 * Phase 3, when those routes exist — see the note there.
 */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const sections = footerSections(locale, dict);

  return (
    <footer className="border-border/60 bg-muted/30 mt-24 border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-foreground font-[family-name:var(--font-archivo)] text-lg font-extrabold tracking-[0.18em] uppercase">
            Belso
          </p>
          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
            {dict.footer.tagline}
          </p>
        </div>

        {sections.map((section) => (
          <nav key={section.title} aria-label={section.title}>
            <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
              {section.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-foreground/80 hover:text-foreground focus-visible:ring-ring rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-border/60 border-t">
        <p className="text-muted-foreground mx-auto w-full max-w-7xl px-6 py-6 text-xs">
          © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
