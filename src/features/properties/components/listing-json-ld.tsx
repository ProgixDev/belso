import { localeTag } from "@/core/i18n";
import { site } from "@/core/site";
import type { Amenity, ListingStatus, LocalizedProperty, PropertyType } from "../types";

/**
 * `RealEstateListing` structured data for one listing — a success condition of
 * the plan ("`RealEstateListing` structured data on every listing"), and the
 * only machine-readable description of the catalogue we publish.
 *
 * Written to be *true* rather than complete: every field below is one a crawler
 * can check against the rendered page, and anything the fixtures cannot honestly
 * fill is left out rather than guessed. A listing that claims five bedrooms in
 * JSON and shows a plot of land is worse than one that claims nothing.
 *
 * Geo coordinates are absent on purpose — the map is not built and inventing a
 * point for a private residence is not a rounding error. They land with it.
 */

/**
 * What the thing being sold actually is. `land` is a `Place`, not a residence:
 * schema.org's accommodation types all imply somewhere you can live, and a
 * building plot in Amelkis is not that.
 */
const ACCOMMODATION_TYPE: Record<PropertyType, string> = {
  villa: "House",
  riad: "House",
  townhouse: "House",
  chalet: "House",
  estate: "House",
  apartment: "Apartment",
  penthouse: "Apartment",
  land: "Place",
};

/** A listing under offer is still available, just not freely — hence Limited. */
const AVAILABILITY: Record<ListingStatus, string> = {
  available: "https://schema.org/InStock",
  underOffer: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
  rented: "https://schema.org/SoldOut",
};

/** UN/CEFACT codes: square metre, month. */
const SQUARE_METRE = "MTK";
const MONTH = "MON";

export type ListingJsonLdLabels = {
  landArea: string;
  amenity: Record<Amenity, string>;
};

export function ListingJsonLd({
  property,
  path,
  labels,
}: {
  property: LocalizedProperty;
  /** The listing's canonical path in this locale, e.g. `/fr/biens/villa-vue-atlas`. */
  path: string;
  labels: ListingJsonLdLabels;
}) {
  const url = `${site.url}${path}`;

  const about = {
    "@type": ACCOMMODATION_TYPE[property.type],
    name: property.title,
    address: {
      "@type": "PostalAddress",
      addressLocality: property.city,
      addressRegion: property.district,
      addressCountry: "MA",
    },
    ...(property.bedrooms > 0 ? { numberOfBedrooms: property.bedrooms } : {}),
    ...(property.bathrooms > 0 ? { numberOfBathroomsTotal: property.bathrooms } : {}),
    ...(property.builtArea > 0
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: property.builtArea,
            unitCode: SQUARE_METRE,
          },
        }
      : {}),
    // Plot size has no first-class property on an accommodation, so it goes
    // through `additionalProperty` with its own unit rather than being folded
    // into `floorSize`, which means the built surface and nothing else.
    ...(property.landArea
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: labels.landArea,
            value: property.landArea,
            unitCode: SQUARE_METRE,
          },
        }
      : {}),
    ...(property.amenities.length > 0
      ? {
          amenityFeature: property.amenities.map((amenity) => ({
            "@type": "LocationFeatureSpecification",
            name: labels.amenity[amenity],
            value: true,
          })),
        }
      : {}),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    url,
    name: property.title,
    // One line: the prose is written with paragraph breaks, which are markup
    // here rather than meaning.
    description: property.description.replace(/\s+/g, " "),
    datePosted: property.listedAt,
    /*
     * The language the text is *in*, which is not always the language of the
     * page: an untranslated listing shows its original prose with a visible
     * note (AC-9), and saying `en` over French text would be a lie a crawler
     * has no way to catch.
     */
    inLanguage: localeTag[property.textLocale],
    image: property.media.slice(0, 6).map((photo) => `${site.url}${photo.url}`),
    about,
    offers: {
      "@type": "Offer",
      url,
      price: property.price,
      priceCurrency: property.currency,
      availability: AVAILABILITY[property.status],
      businessFunction:
        property.kind === "rent"
          ? "http://purl.org/goodrelations/v1#LeaseOut"
          : "http://purl.org/goodrelations/v1#Sell",
      // A rent figure without a period is not a price. Sales carry no period,
      // which is the difference the reference quantity encodes.
      ...(property.kind === "rent"
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: property.price,
              priceCurrency: property.currency,
              referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: MONTH },
            },
          }
        : {}),
    },
  };

  return (
    <script
      type="application/ld+json"
      // `<` is escaped because the payload carries listing prose, which will
      // one day be typed by the manager in the back-office: a `</script>` in a
      // description would otherwise close this tag and everything after it
      // would be parsed as markup (SEC-INPUT-001).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }}
    />
  );
}
