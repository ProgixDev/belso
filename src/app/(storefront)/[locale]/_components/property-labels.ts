import { site } from "@/core/site";
import type { Dictionary } from "@/features/i18n";
import type { PropertyCardLabels } from "@/features/properties";

/**
 * Bridges the dictionary to the properties slice, like `enquiry-labels.ts`.
 *
 * It lives in `app` because that is the only layer allowed to see both the i18n
 * slice and the properties slice (docs/architecture/module-boundaries.md), and
 * in one place because four pages render this card — the grid, a district, a
 * listing's similar row, and the home shelf. Built inline, the fourth one
 * always ends up a label behind.
 *
 * `type` is left out: it is the only value that changes per property.
 */
export function propertyCardLabels(dict: Dictionary): Omit<PropertyCardLabels, "type"> {
  return {
    bedsShort: dict.properties.bedsShort,
    bathsShort: dict.properties.bathsShort,
    parkingShort: dict.properties.parkingShort,
    perMonth: dict.properties.perMonth,
    reference: dict.properties.reference,
    listedOn: dict.properties.listedOn,
    forSale: dict.properties.forSale,
    // The card footer is a narrow column; the full phrase belongs on the
    // detail page badge, where there is room for it.
    forRent: dict.properties.forRentShort,
    // One agency sells everything here, so this is the same on every card —
    // it is the portal layout's brokerage line, told the truth.
    agency: site.name,
    statusUnderOffer: dict.properties.statusUnderOffer,
    statusSold: dict.properties.statusSold,
    statusRented: dict.properties.statusRented,
  };
}
