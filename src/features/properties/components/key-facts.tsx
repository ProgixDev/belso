import type { Locale } from "@/core/i18n";
import { formatArea } from "@/lib/format";
import type { LocalizedProperty } from "../types";

/**
 * The facts a buyer judges a listing on (AC-5), as a description list so the
 * label/value pairing survives without sighted layout.
 *
 * Every row is conditional. A plot has no bedrooms and no built area, and an
 * apartment has no land — rendering those as "0" would read as missing data
 * rather than as the shape of the listing, which is exactly the case the
 * fixtures include to keep this honest.
 */
export function KeyFacts({
  property,
  locale,
  labels,
}: {
  property: LocalizedProperty;
  locale: Locale;
  labels: {
    reference: string;
    type: string;
    typeLabel: string;
    bedrooms: string;
    bathrooms: string;
    builtArea: string;
    landArea: string;
  };
}) {
  const rows: { label: string; value: string }[] = [
    { label: labels.reference, value: property.reference },
    { label: labels.type, value: labels.typeLabel },
  ];

  if (property.bedrooms > 0) {
    rows.push({ label: labels.bedrooms, value: String(property.bedrooms) });
  }
  if (property.bathrooms > 0) {
    rows.push({ label: labels.bathrooms, value: String(property.bathrooms) });
  }
  if (property.builtArea > 0) {
    rows.push({ label: labels.builtArea, value: formatArea(property.builtArea, locale) });
  }
  if (property.landArea && property.landArea > 0) {
    rows.push({ label: labels.landArea, value: formatArea(property.landArea, locale) });
  }

  return (
    <dl className="divide-border/60 divide-y">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-6 py-3">
          <dt className="text-muted-foreground text-sm">{row.label}</dt>
          <dd className="text-sm font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
