import { displayCurrency } from "@/core/currency";
import type { Locale } from "@/core/i18n";
import { formatApproxPrice, formatPrice } from "@/lib/format";
import type { LocalizedProperty } from "../types";

/**
 * The asking price, and the conversion beside it (AC-3, AC-5).
 *
 * The listed currency is always the headline and the conversion is always
 * marked approximate — B-4 (how rates are sourced) is unresolved, so a
 * converted figure must never be able to pass for the asking price.
 */
export function Price({
  property,
  locale,
  perMonthLabel,
  className,
}: {
  property: LocalizedProperty;
  locale: Locale;
  perMonthLabel: string;
  className?: string;
}) {
  const approx = formatApproxPrice(property.price, property.currency, displayCurrency, locale);

  return (
    <div className={className}>
      <p className="font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight">
        {formatPrice(property.price, property.currency, locale)}
        {property.kind === "rent" ? (
          <span className="text-muted-foreground text-base font-normal"> {perMonthLabel}</span>
        ) : null}
      </p>
      {approx ? <p className="text-muted-foreground mt-1 text-sm">{approx}</p> : null}
    </div>
  );
}
