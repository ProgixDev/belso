"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  locales,
  switchLocalePath,
} from "@/core/i18n";

/**
 * Keeps the visitor on the page they are reading when they change language
 * (AC-1). Renders every locale rather than a two-way toggle, so `ar`, `it` and
 * `nl` need no rewrite when they land.
 *
 * The trailing slug is not translated here — only the properties slice can
 * resolve a property's per-locale slug, so detail pages pass their own link.
 *
 * **The click writes the cookie, not the proxy.** Clicking is a client-side
 * navigation, which reaches the proxy as a fetch rather than a document
 * request — and the proxy deliberately only records a language on real
 * navigations, because otherwise Next prefetching this very component's other
 * link silently overwrote the visitor's choice. Recording it here is also
 * simply more truthful: this is the one place a visitor actually chooses.
 */
/**
 * Module scope on purpose: writing `document.cookie` from a closure defined in
 * the component body is a mutation during render as far as the React Compiler
 * is concerned, and it is right to reject it. This is a plain side effect on a
 * click, and belongs outside the component.
 */
function rememberLocale(target: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function LocaleSwitcher({
  locale,
  label,
  slugOverrides,
  tone = "default",
}: {
  locale: Locale;
  label: string;
  /** Per-locale slug for the current record, when the page has one. */
  slugOverrides?: Partial<Record<Locale, string>>;
  /**
   * `chrome` inherits `--chrome-ink` from the site header's glass capsule, so
   * the switcher tints with it over the cinematic scene instead of holding a
   * fixed colour that disappears against half the beats.
   */
  tone?: "default" | "chrome";
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
            onClick={() => rememberLocale(target)}
            className={
              tone === "chrome"
                ? isCurrent
                  ? "rounded-full px-1.5 py-1 font-serif text-[15px] leading-none font-semibold tracking-[0.1em] text-[var(--chrome-ink,currentColor)] uppercase [text-shadow:0_1px_1px_var(--chrome-halo,transparent),0_0_3px_var(--chrome-halo,transparent),0_0_13px_var(--chrome-halo,transparent)]"
                  : "rounded-full px-1.5 py-1 font-serif text-[15px] leading-none tracking-[0.1em] text-[var(--chrome-ink,currentColor)]/55 uppercase transition-opacity [text-shadow:0_1px_1px_var(--chrome-halo,transparent),0_0_3px_var(--chrome-halo,transparent),0_0_13px_var(--chrome-halo,transparent)] hover:text-[var(--chrome-ink,currentColor)] motion-reduce:transition-none"
                : isCurrent
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
