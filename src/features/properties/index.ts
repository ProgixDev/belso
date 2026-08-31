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
  Coordinates,
  ListingKind,
  ListingStatus,
  LocalizedProperty,
  Property,
  PropertyLocation,
  PropertyMedia,
  PropertyQuery,
  PropertySearchParams,
  PropertySort,
  PropertyTranslation,
  PropertyType,
  PropertyView,
} from "./types";

export {
  amenities,
  propertySearchParamsSchema,
  isPropertySort,
  isPropertyView,
  listingKinds,
  listingStatuses,
  propertySorts,
  propertyTypes,
  propertyViews,
} from "./types";

export {
  type District,
  type DistrictId,
  districtIds,
  districtOrder,
  districts,
  isDistrictId,
} from "./districts";

export { approximateLocation, defaultSort, resolveLocation } from "./lib";

export { Gallery } from "./components/gallery";
export { KeyFacts } from "./components/key-facts";
export { ListingJsonLd, type ListingJsonLdLabels } from "./components/listing-json-ld";
/*
 * The map arrives through its loader, never directly. This barrel re-exports
 * `repository.ts`, which is `server-only`, so the map's own module could never
 * be pulled through it into a client bundle — and `app` may not reach past a
 * feature's public API to get at it either. The loader holds the `"use client"`
 * boundary one file inside the slice, which satisfies both, and is also where
 * `ssr: false` has to be declared.
 */
export { PropertyMap } from "./components/property-map-loader";
export type { MapLabels } from "./components/property-map";
export { Price } from "./components/price";
export { PropertyCard, type PropertyCardLabels } from "./components/property-card";
export { ResultsHeader } from "./components/results-header";
export { SortControl } from "./components/sort-control";

export {
  countByDistrict,
  countProperties,
  getCurrentSlugFor,
  getLocaleSlugs,
  getPropertyBySlug,
  getSimilar,
  listProperties,
} from "./repository";

/* -------------------------------------------------------------------------- */
/* The back-office half                                                        */
/* -------------------------------------------------------------------------- */
/*
 * Reads that include drafts, and every write. Exported through the same barrel
 * as the public reads because the boundary rule admits one entry point per
 * slice — but they are separate modules on purpose, and the separation is the
 * audit: `admin-repository.ts` and `writes.ts` go through `editorQuery` and
 * `editorTransaction`, `repository.ts` and `row.ts` do not. If a grep for
 * either of those names ever hits the public read path, the split in ADR-0010
 * has been undone.
 */

export { type EditorListing, getListingForEditor, listListingsForEditor } from "./admin-repository";

export {
  type ListingActionError,
  type ListingActionResult,
  archiveListingAction,
  createListingAction,
  publishListingAction,
  removePhotographAction,
  reorderPhotographsAction,
  saveAltTextAction,
  saveListingAction,
  unpublishListingAction,
  uploadPhotographAction,
} from "./admin-actions";

export { PhotographManager } from "./components/photograph-manager";
export { PropertyEditor } from "./components/property-editor";
export { PublicationControls } from "./components/publication-controls";
