import { type Currency, convert } from "@/core/currency";
import { type Locale, localeTag } from "@/core/i18n";

/**
 * Locale-aware formatting, built on the platform's own `Intl` rather than a
 * dependency. Lives in `shared` because both the properties slice and the page
 * chrome need it, and features may not import each other
 * (docs/architecture/module-boundaries.md).
 */

/** The real asking price, in the currency it was listed in. */
export function formatPrice(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * The converted price, always marked as approximate. Returns null when the
 * conversion is not available or would be a no-op, so callers render nothing
 * rather than a misleading "≈" next to an identical figure.
 */
export function formatApproxPrice(
  amount: number,
  from: Currency,
  to: Currency,
  locale: Locale,
): string | null {
  if (from === to) return null;
  const converted = convert(amount, from, to);
  if (converted === null) return null;
  return `≈ ${formatPrice(Math.round(converted), to, locale)}`;
}

/**
 * The price, short enough to sit in a map pin: "18,5 M MAD", "1,2 M €".
 *
 * `compact` notation rather than a hand-rolled divide-and-suffix, so the
 * abbreviation is the one the locale actually uses — French says "M", English
 * says "M", and a locale that says something else gets it right for free.
 */
export function formatCompactPrice(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Areas are always whole square metres; fractions read as false precision. */
export function formatArea(sqm: number, locale: Locale): string {
  return `${new Intl.NumberFormat(localeTag[locale], { maximumFractionDigits: 0 }).format(sqm)} m²`;
}

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag[locale]).format(value);
}

/**
 * A listing date is a calendar day, not an instant.
 *
 * `new Date("2026-07-28")` parses as midnight **UTC**, so formatting it in any
 * negative-offset timezone renders the 27th — a listing dated a day before it
 * was listed, on every card, for every visitor west of Greenwich. Pinning the
 * output to UTC prints the day that was written down.
 */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(iso));
}
