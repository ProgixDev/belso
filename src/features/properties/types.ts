import { z } from "zod";
import type { Currency } from "@/core/currency";
import type { Locale } from "@/core/i18n";
import type { DistrictId } from "./districts";

/**
 * The property domain, shaped the way the future database will be — one row per
 * property, translations and media in their own collections keyed by locale.
 * Fixtures satisfy this today (`fixtures/`); Phase 2 swaps `repository.ts` for
 * Supabase queries without any of these types moving.
 *
 * The vocabularies below are **provisional (B-3)** — the exhaustive type and
 * amenity list has not been supplied. They are unions rather than plain strings
 * so that fixing B-3 is a compile error at every call site instead of a silent
 * mismatch in the data.
 */

export const propertyTypes = [
  "villa",
  "riad",
  "apartment",
  "penthouse",
  "townhouse",
  "land",
  "chalet",
  "estate",
] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const amenities = [
  "pool",
  "garden",
  "terrace",
  "hammam",
  "gym",
  "garage",
  "airConditioning",
  "underfloorHeating",
  "staffQuarters",
  "security",
  "elevator",
  "golfAccess",
  "atlasView",
  "furnished",
] as const;
export type Amenity = (typeof amenities)[number];

/** What a listing is offered as. Rentals are long-term only (spec, out of scope: seasonal). */
export const listingKinds = ["sale", "rent"] as const;
export type ListingKind = (typeof listingKinds)[number];

/**
 * Availability. `sold`, `underOffer` and `rented` still render — a listing that
 * vanishes the day it sells looks like a broken link to anyone holding the URL,
 * and the badge is what tells the story (AC-3 grid, AC-5 detail).
 */
export const listingStatuses = ["available", "underOffer", "sold", "rented"] as const;
export type ListingStatus = (typeof listingStatuses)[number];

/** WGS84, the only coordinate system anything here speaks. */
export type Coordinates = { lat: number; lng: number };

/**
 * Where a listing is shown on the map, and how much that should be trusted.
 *
 * `precision` is **derived, never stored**: `exact` when the listing carries a
 * coordinate of its own, `approximate` when the point was computed from its
 * district. That is what lets the "approximate location" caveat switch itself
 * off the day the back-office supplies a real address — no flag to remember,
 * no second screen to build.
 */
export type PropertyLocation = Coordinates & {
  precision: "exact" | "approximate";
};

/** One photograph. `alt` is per-locale because it is read aloud, not decoration. */
export type PropertyMedia = {
  id: string;
  /** Path under `public/`, or an absolute URL once real photography lands. */
  url: string;
  width: number;
  height: number;
  /**
   * **`Partial`, and the change from `Record` is the point.**
   *
   * Every seeded photograph carries both locales, so a full `Record` typechecked
   * and `alt[locale]` was never once `undefined` — right up until spec 011 lets
   * the client caption a photograph in French alone, which is exactly what she is
   * being encouraged to do. The first such caption would have rendered
   * `alt={undefined}` on the **English** site: the photograph announced by its
   * file name, by the feature built to stop alt text being an afterthought.
   *
   * As `Partial`, `alt[locale]` is `string | undefined` and will not satisfy
   * `<Image alt>`, so the compiler refuses every reader that has not thought
   * about a missing locale. Read it through `altFor` in `lib.ts`, the way prose
   * is read through `resolveTranslation` — the rule is the same and so is the
   * reason for it.
   */
  alt: Partial<Record<Locale, string>>;
};

/**
 * The translatable half of a listing. A locale may be **absent** — that is the
 * whole point of AC-9, and why `Partial` is deliberate here rather than an
 * oversight. Read it through `resolveTranslation`, never by index.
 */
export type PropertyTranslation = {
  /** Per-locale slug: `/fr/biens/villa-vue-atlas` vs `/en/properties/villa-atlas-view`. */
  slug: string;
  title: string;
  /** Long-form prose. Fixture lengths vary on purpose (docs/design/quality-bar.md). */
  description: string;
  district: string;
  city: string;
};

export type Property = {
  id: string;
  /** The agency's own reference, quoted in enquiries (AC-6). */
  reference: string;
  /**
   * Which district it stands in, as an id rather than the printed name.
   *
   * The name lives in `translations[locale].district` because it is prose that
   * changes language ("Route de l’Ourika" / "Ourika road"). Grouping listings
   * by a translated string would put the same road in two districts depending
   * on who was reading, which is how the id came to exist.
   */
  districtId: DistrictId;
  kind: ListingKind;
  type: PropertyType;
  status: ListingStatus;
  /** The asking price in the currency it was **listed** in. Everything else is a conversion. */
  price: number;
  currency: Currency;
  bedrooms: number;
  bathrooms: number;
  /** Square metres. `landArea` is absent for apartments, which have no plot. */
  builtArea: number;
  landArea?: number;
  /**
   * Year of construction. Absent for land, which has none — and optional
   * rather than zero so a card can leave the slot out instead of printing a
   * year nobody built anything in.
   */
  builtYear?: number;
  /** Covered or allocated spaces. Zero is a real answer in the medina. */
  parking: number;
  /**
   * The listing's own position, when someone has supplied one.
   *
   * Optional, and **absent from every fixture on purpose**. Twenty hand-written
   * latitudes would be twenty fabrications shaped like survey data; a listing
   * without this is placed inside its district instead, and says so. This is
   * the shape the `lat, lng` columns in `plan.md` §4 map onto.
   */
  coordinates?: Coordinates;
  amenities: Amenity[];
  media: PropertyMedia[];
  /** ISO date — drives the "most recently listed" sort (AC-3). */
  listedAt: string;
  translations: Partial<Record<Locale, PropertyTranslation>>;
};

/** How a visitor can reorder the set (AC-3). `newest` is the default. */
export const propertySorts = ["newest", "priceAsc", "priceDesc"] as const;
export type PropertySort = (typeof propertySorts)[number];

export function isPropertySort(value: unknown): value is PropertySort {
  return typeof value === "string" && (propertySorts as readonly string[]).includes(value);
}

/** Which way the catalogue is being read: as a list, or as a map. */
export const propertyViews = ["grid", "map"] as const;
export type PropertyView = (typeof propertyViews)[number];

export function isPropertyView(value: unknown): value is PropertyView {
  return typeof value === "string" && (propertyViews as readonly string[]).includes(value);
}

/**
 * The listings URL, validated (SEC-INPUT-001).
 *
 * `searchParams` is a trust boundary: anyone can put anything in a query
 * string. Nothing here reaches a database or a shell, but `q` is echoed back
 * into the page and tokenised against every listing on every request, so it is
 * bounded rather than taken on faith. Both fields `catch` instead of throwing —
 * a stale link with a dead `?sort=` is a typo, not a 500.
 */
export const propertySearchParamsSchema = z.object({
  q: z.string().trim().max(200).catch(""),
  sort: z.enum(propertySorts).catch("newest"),
  view: z.enum(propertyViews).catch("grid"),
});

export type PropertySearchParams = z.infer<typeof propertySearchParamsSchema>;

/** What the listings page asks the repository for. */
export type PropertyQuery = {
  /** The visitor's own words, echoed back to them on the results page (AC-2). */
  query?: string;
  sort?: PropertySort;
  /** Narrow to one district — what a district page asks for. */
  district?: DistrictId;
  locale: Locale;
};

/**
 * A property resolved for one locale — what components actually render, so no
 * component ever has to think about the fallback rule.
 *
 * `isFallback` says the text below is not in the requested language, which is
 * what AC-9's visible note is driven by. The UI reads the flag rather than
 * comparing strings.
 */
export type LocalizedProperty = Omit<Property, "translations"> & {
  locale: Locale;
  /** The locale the text is actually written in — differs from `locale` when falling back. */
  textLocale: Locale;
  isFallback: boolean;
  /** Always present: derived from the district when the listing has no coordinate. */
  location: PropertyLocation;
  slug: string;
  title: string;
  description: string;
  district: string;
  city: string;
};
