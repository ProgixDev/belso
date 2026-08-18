/**
 * Public API of the properties slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 *
 * `repository.ts` is re-exported here even though it is `server-only`, because
 * the boundary rule admits no second entry point and relaxing it would need an
 * ADR. The consequence to know about: importing **anything** from this barrel
 * into a client component pulls `server-only` with it and fails the build. That
 * is the guard doing its job, not a bug — but the error names `server-only`
 * rather than the barrel, so the cause is not obvious from the message. Server
 * pages compose this slice; client islands inside it import their neighbours
 * by relative path.
 */

export type {
  Amenity,
  ListingKind,
  ListingStatus,
  LocalizedProperty,
  Property,
  PropertyMedia,
  PropertyQuery,
  PropertySearchParams,
  PropertySort,
  PropertyTranslation,
  PropertyType,
} from "./types";

export {
  amenities,
  propertySearchParamsSchema,
  isPropertySort,
  listingKinds,
  listingStatuses,
  propertySorts,
  propertyTypes,
} from "./types";

export { defaultSort } from "./lib";

export { Gallery } from "./components/gallery";
export { KeyFacts } from "./components/key-facts";
export { ListingJsonLd, type ListingJsonLdLabels } from "./components/listing-json-ld";
export { Price } from "./components/price";
export { PropertyCard, type PropertyCardLabels } from "./components/property-card";
export { ResultsHeader } from "./components/results-header";
export { SortControl } from "./components/sort-control";

export {
  countProperties,
  getLocaleSlugs,
  getPropertyBySlug,
  getSimilar,
  listProperties,
} from "./repository";
