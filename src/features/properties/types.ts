import type { Currency } from "@/core/currency";
import type { Locale } from "@/core/i18n";

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

/** One photograph. `alt` is per-locale because it is read aloud, not decoration. */
export type PropertyMedia = {
  id: string;
  /** Path under `public/`, or an absolute URL once real photography lands. */
  url: string;
  width: number;
  height: number;
  alt: Record<Locale, string>;
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

/** What the listings page asks the repository for. */
export type PropertyQuery = {
  /** The visitor's own words, echoed back to them on the results page (AC-2). */
  query?: string;
  sort?: PropertySort;
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
  slug: string;
  title: string;
  description: string;
  district: string;
  city: string;
};
