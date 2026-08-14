/**
 * Currencies and the conversion table.
 *
 * B-4 is unresolved: the cahier des charges has not settled whether rates are
 * entered by hand or pulled from an FX API. Until it does, this is a fixed
 * table and every converted figure must be rendered as an approximation next
 * to the real asking price (plan.md §4 — one price, one currency; everything
 * else is a conversion).
 *
 * Phase 5 replaces `rates` with the `exchange_rates` table. Nothing else about
 * the shape changes, which is why callers take a rate table rather than
 * reaching for a constant.
 */

export const currencies = ["MAD", "EUR", "USD"] as const;
export type Currency = (typeof currencies)[number];

/** The currency a visitor sees conversions in, unless they pick another. */
export const displayCurrency: Currency = "EUR";

/** Units of each currency per 1 MAD. Provisional — see B-4. */
export const ratesFromMad: Record<Currency, number> = {
  MAD: 1,
  EUR: 0.0922,
  USD: 0.1006,
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (currencies as readonly string[]).includes(value);
}

/**
 * Convert between currencies through MAD. Returns null when the pair cannot be
 * resolved, so the UI can omit the approximation rather than print a wrong one.
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number> = ratesFromMad,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}
