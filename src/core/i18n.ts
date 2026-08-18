/**
 * Locale configuration — the single source for routing, detection and the
 * translated URL segments.
 *
 * This lives in `core`, not in `src/features/i18n`, because `src/proxy.ts`
 * needs it and the boundary rules forbid importing a feature from there
 * (docs/architecture/module-boundaries.md). The slice owns the dictionaries
 * and the UI; this file owns the facts about locales.
 *
 * Only `fr` and `en` ship today. `ar`, `it` and `nl` are planned (plan.md §6);
 * adding one is a matter of extending `locales`, `localeDirection` and the
 * segment table — no routing code changes. Arabic will also flip `dir`, which
 * is why direction is data here rather than assumed to be "ltr" at the call site.
 */

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Writing direction per locale. Drives `<html dir>`; `ar` will be "rtl". */
export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  en: "ltr",
};

/** BCP-47 tags used for `Intl` formatting and `hreflang`. */
export const localeTag: Record<Locale, string> = {
  fr: "fr-MA",
  en: "en-GB",
};

/** Where a visitor's explicit choice is remembered. */
export const LOCALE_COOKIE = "belso_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Public route segments, per locale. The key is the *internal* segment — the
 * folder name under `src/app/[locale]/` — and the value is the word a visitor
 * sees. Translating these is a stated SEO requirement (plan.md §6), so the
 * public URL is `/fr/biens/…` while the app directory stays `/properties/…`.
 */
export const routeSegments = {
  properties: { fr: "biens", en: "properties" },
  districts: { fr: "quartiers", en: "neighbourhoods" },
  about: { fr: "a-propos", en: "about" },
  sell: { fr: "vendre", en: "sell" },
  contact: { fr: "contact", en: "contact" },
  legal: { fr: "legal", en: "legal" },
} as const satisfies Record<string, Record<Locale, string>>;

export type InternalSegment = keyof typeof routeSegments;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Internal segment → the word shown in the URL for this locale. */
export function publicSegment(segment: InternalSegment, locale: Locale): string {
  return routeSegments[segment][locale];
}

/** The word in the URL → the internal segment, or null if it isn't one of ours. */
export function internalSegment(segment: string, locale: Locale): InternalSegment | null {
  for (const key of Object.keys(routeSegments) as InternalSegment[]) {
    if (routeSegments[key][locale] === segment) return key;
  }
  return null;
}

const splitPath = (path: string) =>
  path
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

/**
 * Internal path → the public URL a visitor sees.
 * `("/properties/villa", "fr")` → `"/fr/biens/villa"`.
 */
export function toPublicPath(internalPath: string, locale: Locale): string {
  const parts = splitPath(internalPath);
  if (parts.length === 0) return `/${locale}`;
  const [head, ...rest] = parts;
  const translated =
    head && head in routeSegments ? publicSegment(head as InternalSegment, locale) : head;
  return `/${[locale, translated, ...rest].join("/")}`;
}

/**
 * Public URL → the path Next should actually render, i.e. the app-directory
 * path. `("/fr/biens/villa")` → `"/fr/properties/villa"`. Returns null when the
 * path carries no known locale, so the caller can decide what to do.
 */
export function toInternalPath(publicPath: string): string | null {
  const parts = splitPath(publicPath);
  const [maybeLocale, ...rest] = parts;
  if (!isLocale(maybeLocale)) return null;
  if (rest.length === 0) return `/${maybeLocale}`;
  const [head, ...tail] = rest;
  const internal = head ? internalSegment(head, maybeLocale) : null;
  return `/${[maybeLocale, internal ?? head, ...tail].join("/")}`;
}

/**
 * Rewrite a public path from one locale to another, keeping the visitor on the
 * page they were reading (AC-1). `("/fr/biens/villa-vue-atlas", "en")` →
 * `"/en/properties/villa-vue-atlas"`.
 *
 * The trailing slug is *not* translated here — that needs the property's own
 * per-locale slug, which only the properties slice can resolve. Callers that
 * have the property pass its translated slug in `slugOverride`.
 */
export function switchLocalePath(
  publicPath: string,
  target: Locale,
  slugOverride?: string,
): string {
  const parts = splitPath(publicPath);
  const [maybeLocale, ...rest] = parts;
  const from = isLocale(maybeLocale) ? maybeLocale : defaultLocale;
  const tail = isLocale(maybeLocale) ? rest : parts;
  if (tail.length === 0) return `/${target}`;

  const [head, ...remainder] = tail;
  const internal = head ? internalSegment(head, from) : null;
  const translatedHead = internal ? publicSegment(internal, target) : head;
  const translatedTail =
    slugOverride && remainder.length > 0 ? [slugOverride, ...remainder.slice(1)] : remainder;

  return `/${[target, translatedHead, ...translatedTail].join("/")}`;
}

/**
 * Pick a locale for a visitor who has not chosen one. A stored choice always
 * wins — plan.md §6 is explicit that detection must never trap someone in a
 * language they did not pick.
 */
export function detectLocale(acceptLanguage: string | null, cookie?: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1] ?? "1") : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
