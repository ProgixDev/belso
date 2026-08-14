"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, locales, switchLocalePath } from "@/core/i18n";

/**
 * Keeps the visitor on the page they are reading when they change language
 * (AC-1). Renders every locale rather than a two-way toggle, so `ar`, `it` and
 * `nl` need no rewrite when they land.
 *
 * The trailing slug is not translated here — only the properties slice can
 * resolve a property's per-locale slug, so detail pages pass their own link.
 */
export function LocaleSwitcher({
  locale,
  label,
  slugOverrides,
}: {
  locale: Locale;
  label: string;
  /** Per-locale slug for the current record, when the page has one. */
  slugOverrides?: Partial<Record<Locale, string>>;
}) {
  const pathname = usePathname() ?? `/${locale}`;

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {locales.map((target) => {
        const isCurrent = target === locale;
        return (
          <Link
            key={target}
            href={switchLocalePath(pathname, target, slugOverrides?.[target])}
            hrefLang={target}
            aria-current={isCurrent ? "true" : undefined}
            className={
              isCurrent
                ? "rounded-sm px-2 py-1 text-xs font-semibold tracking-widest uppercase"
                : "text-muted-foreground hover:text-foreground rounded-sm px-2 py-1 text-xs tracking-widest uppercase transition-colors"
            }
          >
            {target}
          </Link>
        );
      })}
    </nav>
  );
}
