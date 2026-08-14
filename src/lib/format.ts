/**
 * Shared Intl-based formatters (docs/conventions/copy.md): user-visible dates and
 * numbers always go through these — never hand-rolled string math.
 */

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const numberFormatter = new Intl.NumberFormat("en");

export function formatDate(date: Date | number): string {
  return dateFormatter.format(date);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
