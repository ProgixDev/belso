/**
 * Public API of the properties slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 *
 * `repository.ts` is deliberately **not** re-exported here. It is `server-only`,
 * and routing it through the barrel would pull that constraint into every
 * client component that imports a card from this slice.
 * Server pages import it directly: `@/features/properties/repository`.
 */

export type {
  Amenity,
  ListingKind,
  ListingStatus,
  LocalizedProperty,
  Property,
  PropertyMedia,
  PropertyQuery,
  PropertySort,
  PropertyTranslation,
  PropertyType,
} from "./types";

export {
  amenities,
  isPropertySort,
  listingKinds,
  listingStatuses,
  propertySorts,
  propertyTypes,
} from "./types";

export { defaultSort } from "./lib";
