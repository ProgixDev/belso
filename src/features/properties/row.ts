import "server-only";
import type { Locale } from "@/core/i18n";
import { query } from "@/core/db";
import { isDistrictId } from "./districts";
import type {
  Amenity,
  ListingKind,
  ListingStatus,
  Property,
  PropertyMedia,
  PropertyTranslation,
  PropertyType,
} from "./types";

/**
 * The database's rows, turned back into the domain.
 *
 * Kept out of `repository.ts` so the SQL and the mapping are separately
 * testable, and because this is where the type system stops helping: a `select`
 * returns `any`-shaped rows, so every field crossing this boundary is an
 * assertion about what the query produced. `repository.golden.test.ts` is what
 * checks those assertions against the twenty listings the site actually shows.
 *
 * Three conversions here are not cosmetic, and each is a bug that shipped
 * somewhere before:
 *
 * - **`numeric` arrives as a string.** `pg` will not silently narrow it to a
 *   float, because for most `numeric` columns that would lose precision. Prices
 *   are well inside float64's exact-integer range, so `Number()` is safe — but
 *   it has to be deliberate, and `"12800000.00" !== 12800000` would otherwise
 *   fail the golden snapshot on every single listing.
 * - **`date` must not become a `Date`.** `listedAt` is an ISO day string, and
 *   `formatDate` was already bitten once by a `Date` being UTC midnight and
 *   printing the day before. The query casts to text so a timezone never enters
 *   the picture.
 * - **A missing translation is a missing key, not an empty object.**
 *   `PropertyTranslation` is `Partial` by design (AC-9) and one fixture has no
 *   English at all; a `{}` there would make `resolveTranslation` fall back to
 *   the wrong thing.
 */

/** Exactly the shape the query below returns, before any of it is trusted. */
export type PropertyRow = {
  id: string;
  reference: string;
  district_id: string;
  kind: string;
  type: string;
  status: string;
  price: string;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  built_area: number;
  land_area: number | null;
  built_year: number | null;
  parking: number;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  listed_at: string;
  translations: Record<string, PropertyTranslation> | null;
  media: (Omit<PropertyMedia, "alt"> & { alt: Record<string, string> | null })[] | null;
};

/**
 * Everything a published listing is, in one round trip.
 *
 * One query rather than one per listing plus one per translation: the detail
 * page, the catalogue, the district pages and the map all want whole listings,
 * and twenty of them fit comfortably in a single result. Lateral joins keep the
 * aggregation per-property, so a listing with no media yields `null` rather
 * than disappearing from an inner join — which is how a `draft` with no
 * photographs would otherwise vanish twice over.
 */
const SELECT_PUBLISHED = `
  select
    p.id, p.reference, p.district_id, p.kind, p.type, p.status,
    -- text, not float: see the note above.
    p.price::text as price, p.currency,
    p.bedrooms, p.bathrooms, p.built_area, p.land_area, p.built_year, p.parking,
    p.lat, p.lng, p.amenities,
    -- text, so no timezone is ever applied to a calendar day.
    p.listed_at::text as listed_at,
    t.translations,
    m.media
  from properties p
  left join lateral (
    select jsonb_object_agg(
      tr.locale,
      jsonb_build_object(
        'slug', tr.slug, 'title', tr.title, 'description', tr.description,
        'district', tr.district, 'city', tr.city
      )
    ) as translations
    from property_translations tr
    where tr.property_id = p.id
  ) t on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pm.id, 'url', pm.url, 'width', pm.width, 'height', pm.height,
        'alt', coalesce(alt.map, '{}'::jsonb)
      )
      order by pm.position
    ) as media
    from property_media pm
    left join lateral (
      select jsonb_object_agg(a.locale, a.alt) as map
      from property_media_alt a
      where a.media_id = pm.id
    ) alt on true
    where pm.property_id = p.id
  ) m on true
  -- The filter that matters, applied once, here, rather than at six callers.
  where p.publication = 'published'
`;

export function toProperty(row: PropertyRow): Property {
  if (!isDistrictId(row.district_id)) {
    // A foreign key guarantees the district exists; it cannot guarantee the
    // TypeScript union still lists it. Failing loudly beats a listing that
    // silently loses its neighbourhood page.
    throw new Error(`property ${row.reference} names an unknown district: ${row.district_id}`);
  }

  const media: PropertyMedia[] = (row.media ?? []).map((item) => ({
    id: item.id,
    url: item.url,
    width: item.width,
    height: item.height,
    alt: (item.alt ?? {}) as Record<Locale, string>,
  }));

  return {
    id: row.id,
    reference: row.reference,
    districtId: row.district_id,
    kind: row.kind as ListingKind,
    type: row.type as PropertyType,
    status: row.status as ListingStatus,
    price: Number(row.price),
    currency: row.currency as Property["currency"],
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtArea: row.built_area,
    // `undefined`, not `null`: the domain type says "absent", and a card checks
    // for absence to leave the slot out rather than print a zero.
    landArea: row.land_area ?? undefined,
    builtYear: row.built_year ?? undefined,
    parking: row.parking,
    coordinates: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : undefined,
    amenities: row.amenities as Amenity[],
    media,
    listedAt: row.listed_at,
    translations: (row.translations ?? {}) as Property["translations"],
  };
}

/**
 * Every published listing, as the domain sees them.
 *
 * The whole catalogue, deliberately. At twenty listings — and at the 100–500
 * the product plan anticipates — the honest engineering answer is that the
 * database is the *store* and the existing pure functions remain the query
 * engine. `matchScore`, `sortProperties` and `pickSimilar` already decide what
 * a visitor sees, they are tested, and reimplementing their behaviour in SQL is
 * how "the same twenty properties, in the same order" (AC-1) quietly stops
 * being true.
 *
 * Pushing filters and ordering down into SQL is a real optimisation and a
 * deliberate later step — with the golden snapshot standing guard over it.
 */
export async function loadPublishedProperties(): Promise<Property[]> {
  const rows = await query<PropertyRow>(SELECT_PUBLISHED);
  return rows.map(toProperty);
}

/** One listing by an address it holds now, in any language. */
export async function loadBySlug(slug: string): Promise<Property | null> {
  const rows = await query<PropertyRow>(
    `${SELECT_PUBLISHED}
       and exists (
         select 1 from property_translations s
         where s.property_id = p.id and s.slug = $1
       )
     limit 1`,
    [slug],
  );

  return rows[0] ? toProperty(rows[0]) : null;
}

/**
 * An address a listing used to hold (AC-7).
 *
 * Separate from `loadBySlug` rather than folded into it with an `or`, because
 * the caller needs to know *which* happened: a current slug renders, a retired
 * one has to redirect to the current address or the two URLs compete for the
 * same page in a crawler's index.
 */
export async function loadRetiredSlug(
  slug: string,
): Promise<{ propertyId: string; locale: string } | null> {
  const rows = await query<{ property_id: string; locale: string }>(
    `select property_id, locale from property_slug_history where slug = $1
     order by retired_at desc limit 1`,
    [slug],
  );

  const found = rows[0];
  return found ? { propertyId: found.property_id, locale: found.locale } : null;
}
