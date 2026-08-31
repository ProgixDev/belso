#!/usr/bin/env node
/**
 * Load today's districts and listings into the database.
 *
 * Reads **the same** `districts.ts` and `fixtures/properties.ts` the site and
 * the golden snapshot read — not a copy, not an export. That is what makes
 * AC-1 meaningful: if the seed and the fixtures could drift, comparing the
 * database's output to the frozen fixture output would prove nothing.
 *
 * **Idempotent** (AC-8). Everything upserts on a natural key — the district id,
 * the listing reference, the media id — so running it twice leaves twenty
 * listings, not forty. A seed that can only be run against an empty database is
 * a seed nobody dares run.
 *
 * Everything lands as `published`, because that is what the fixtures represent:
 * the catalogue as the site shows it today. Draft and archived are states the
 * back-office will produce.
 *
 * Run: `pnpm db:seed` (with DATABASE_URL set — see `pnpm db:tunnel`).
 */
import pg from "pg";
import "./lib/env-local.mjs";
import { districts, districtOrder } from "../src/features/properties/districts.ts";
import { propertyFixtures } from "../src/features/properties/fixtures/index.ts";
import { locales } from "../src/core/i18n.ts";

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("seed: DATABASE_URL is not set — see `pnpm db:tunnel`.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("begin");

  // -- Districts ------------------------------------------------------------
  // `districtOrder`, not `districtIds` — they are deliberately different
  // sequences (Guéliz and Hivernage are swapped), and the index presents the
  // order, city outwards.
  for (const [position, id] of districtOrder.entries()) {
    const district = districts[id];
    await client.query(
      `insert into districts (id, position, center_lat, center_lng)
       values ($1, $2, $3, $4)
       on conflict (id) do update
         set position = excluded.position,
             center_lat = excluded.center_lat,
             center_lng = excluded.center_lng,
             updated_at = now()`,
      [id, position, district.center.lat, district.center.lng],
    );

    for (const locale of locales) {
      const copy = district.copy[locale];
      if (!copy) continue;
      await client.query(
        `insert into district_translations (district_id, locale, name, lede, body)
         values ($1, $2, $3, $4, $5)
         on conflict (district_id, locale) do update
           set name = excluded.name, lede = excluded.lede, body = excluded.body`,
        [id, locale, copy.name, copy.lede, copy.body],
      );
    }
  }

  // -- Properties -----------------------------------------------------------
  for (const property of propertyFixtures) {
    await client.query(
      `insert into properties (
         id, reference, district_id, kind, type, status, publication,
         price, currency, bedrooms, bathrooms, built_area, land_area,
         built_year, parking, lat, lng, amenities, listed_at
       ) values (
         $1,$2,$3,$4,$5,$6,'published',
         $7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16,$17,$18
       )
       on conflict (reference) do update set
         district_id = excluded.district_id, kind = excluded.kind,
         type = excluded.type, status = excluded.status,
         price = excluded.price, currency = excluded.currency,
         bedrooms = excluded.bedrooms, bathrooms = excluded.bathrooms,
         built_area = excluded.built_area, land_area = excluded.land_area,
         built_year = excluded.built_year, parking = excluded.parking,
         lat = excluded.lat, lng = excluded.lng,
         amenities = excluded.amenities, listed_at = excluded.listed_at,
         updated_at = now()`,
      [
        property.id,
        property.reference,
        property.districtId,
        property.kind,
        property.type,
        property.status,
        property.price,
        property.currency,
        property.bedrooms,
        property.bathrooms,
        property.builtArea,
        property.landArea ?? null,
        property.builtYear ?? null,
        property.parking,
        // Null on every fixture, deliberately — see types.ts. The map places
        // these by district and says the position is approximate.
        property.coordinates?.lat ?? null,
        property.coordinates?.lng ?? null,
        property.amenities,
        property.listedAt,
      ],
    );

    for (const [locale, translation] of Object.entries(property.translations)) {
      if (!translation) continue;
      await client.query(
        `insert into property_translations
           (property_id, locale, slug, title, description, district, city)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (property_id, locale) do update
           set slug = excluded.slug, title = excluded.title,
               description = excluded.description,
               district = excluded.district, city = excluded.city`,
        [
          property.id,
          locale,
          translation.slug,
          translation.title,
          translation.description,
          translation.district,
          translation.city,
        ],
      );
    }

    for (const [position, media] of property.media.entries()) {
      await client.query(
        `insert into property_media (id, property_id, url, width, height, position)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update
           set property_id = excluded.property_id, url = excluded.url,
               width = excluded.width, height = excluded.height,
               position = excluded.position`,
        [media.id, property.id, media.url, media.width, media.height, position],
      );

      for (const [locale, alt] of Object.entries(media.alt)) {
        await client.query(
          `insert into property_media_alt (media_id, locale, alt)
           values ($1,$2,$3)
           on conflict (media_id, locale) do update set alt = excluded.alt`,
          [media.id, locale, alt],
        );
      }
    }
  }

  await client.query("commit");

  const counts = await client.query(`
    select
      (select count(*) from districts)             as districts,
      (select count(*) from properties)            as properties,
      (select count(*) from property_translations) as translations,
      (select count(*) from property_media)        as media
  `);
  const { districts: d, properties: p, translations: t, media: m } = counts.rows[0];
  console.log(`seed ✓ ${d} districts · ${p} properties · ${t} translations · ${m} media`);
} catch (error) {
  await client.query("rollback");
  console.error(`seed ✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
