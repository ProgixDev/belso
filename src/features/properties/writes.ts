import "server-only";
import { randomUUID } from "node:crypto";
import { PostgresError, type Tx, editorTransaction } from "@/core/db";
import type { Currency } from "@/core/currency";
import { type Locale, defaultLocale } from "@/core/i18n";
import type { DistrictId } from "./districts";
import type { Amenity, ListingKind, ListingStatus, PropertyType } from "./types";

/**
 * Every write the back-office makes to the catalogue.
 *
 * Beside `repository.ts` rather than in an admin slice, because features may
 * not import features and this is the same domain written the other way round.
 * The two are deliberately separate files: `grep editorTransaction repository.ts`
 * returning nothing is the proof that the public read path cannot write
 * (ADR-0010).
 *
 * **Three rules hold for every function here.**
 *
 * 1. *One transaction.* A listing is a row, N translations, M photographs and
 *    M×locale captions. Written outside a transaction, a save that fails on the
 *    fourth statement leaves a listing that exists with half its content —
 *    visible in the editor, wrong on the website, repairable only by hand.
 * 2. *The version check is the first statement, and it locks.* See
 *    `lockAtVersion`. A check that does not lock is a check two people pass at
 *    the same moment.
 * 3. *Constraint violations become domain errors.* Postgres says `23505`; the
 *    client needs to be told that address is already taken. The translation
 *    happens here, once, rather than at each screen.
 */

/* -------------------------------------------------------------------------- */
/* What the caller can be told                                                 */
/* -------------------------------------------------------------------------- */

/** The listing is gone — archived is not gone, so this really means deleted. */
export class ListingNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`No listing with id ${id}.`);
    this.name = "ListingNotFoundError";
  }
}

/**
 * Somebody else saved first (AC-10).
 *
 * Thrown from inside the transaction, which both reports the conflict and rolls
 * the attempt back in one move — `editorTransaction` deliberately passes a
 * callback's own error through untouched so this arrives as itself rather than
 * as a database outage.
 */
export class ConcurrentEditError extends Error {
  constructor() {
    super("The listing changed while it was being edited.");
    this.name = "ConcurrentEditError";
  }
}

/** Two listings cannot share an address in one language. */
export class SlugTakenError extends Error {
  constructor(readonly locale: Locale) {
    super(`That address is already used by another listing in ${locale}.`);
    this.name = "SlugTakenError";
  }
}

/** Two listings cannot share the agency's reference — every enquiry quotes it. */
export class ReferenceTakenError extends Error {
  constructor() {
    super("That reference is already used by another listing.");
    this.name = "ReferenceTakenError";
  }
}

/** French is not optional, and removing it is not an edit (AC-3). */
export class FrenchRequiredError extends Error {
  constructor() {
    super("A listing cannot exist without its French text.");
    this.name = "FrenchRequiredError";
  }
}

/* -------------------------------------------------------------------------- */
/* What a caller supplies                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The untranslatable half of a listing.
 *
 * `price` is a **string**, and that is not an oversight. The column is
 * `numeric(14,2)` because money is not a float, and `pg` reads it back as text
 * for the same reason; sending a JavaScript number would round-trip the asking
 * price of a villa through a binary float on the way in. It arrives from a form
 * as text and it stays text.
 */
export type ListingFields = {
  reference: string;
  districtId: DistrictId;
  kind: ListingKind;
  type: PropertyType;
  status: ListingStatus;
  price: string;
  currency: Currency;
  bedrooms: number;
  bathrooms: number;
  builtArea: number;
  landArea: number | null;
  builtYear: number | null;
  parking: number;
  lat: number | null;
  lng: number | null;
  amenities: Amenity[];
  /** `YYYY-MM-DD`. A date, not a timestamp — see `0001`. */
  listedAt: string;
};

/** One language's text. `slug` is the address; changing it retires the old one. */
export type ListingText = {
  slug: string;
  title: string;
  description: string;
  district: string;
  city: string;
};

/**
 * What to do with each language.
 *
 * Absent means *leave it alone*; `null` means *remove it*. The distinction
 * matters because an editor form always submits every field, so "the English
 * boxes are empty" has to be turned into one of those two intentions before it
 * reaches here — and it is the action's job to decide which (T15, T18). Writing
 * empty strings instead would put a listing on the English site with a blank
 * title and no note explaining why, which is worse than either.
 */
export type ListingTexts = Partial<Record<Locale, ListingText | null>>;

/* -------------------------------------------------------------------------- */
/* The concurrency check                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Read the version, refuse if it moved, and **hold the row until the
 * transaction ends**.
 *
 * `for update` is the whole of it. Without the lock this is a read followed by
 * a write, and two people saving the same listing in the same second both read
 * version 4, both find it equal to what their form carried, and both proceed —
 * the check passing for both is exactly the outcome AC-10 exists to prevent.
 * With it, the second transaction blocks here until the first commits, then
 * reads version 5 and is told.
 *
 * It is the first statement of every function below for the same reason: any
 * write issued before it is a write that happens whether or not the caller was
 * allowed to make it.
 */
async function lockAtVersion(tx: Tx, id: string, expected: number): Promise<void> {
  const rows = await tx.query<{ version: number }>(
    "select version from properties where id = $1 for update",
    [id],
  );

  const current = rows[0];
  if (!current) throw new ListingNotFoundError(id);
  if (current.version !== expected) throw new ConcurrentEditError();
}

/** The version after the triggers have had their say — what the form carries next. */
async function versionOf(tx: Tx, id: string): Promise<number> {
  const rows = await tx.query<{ version: number }>("select version from properties where id = $1", [
    id,
  ]);
  const current = rows[0];
  if (!current) throw new ListingNotFoundError(id);
  return current.version;
}

/**
 * Turn a unique violation into something a person can act on.
 *
 * Keyed on the constraint name rather than on the message, which is localised
 * by Postgres and would make this depend on the server's `lc_messages`.
 */
function asDomainError(error: unknown): unknown {
  if (!(error instanceof PostgresError) || error.code !== "23505") return error;

  if (error.constraint === "properties_reference_key") return new ReferenceTakenError();
  if (error.constraint === "property_translations_locale_slug_key") {
    /*
     * The constraint does not say which language collided, and the statement
     * that raised it did. Rather than parse the message, callers that write
     * more than one language wrap each write — see `writeText`.
     */
    return new SlugTakenError(defaultLocale);
  }

  return error;
}

/* -------------------------------------------------------------------------- */
/* The writes                                                                  */
/* -------------------------------------------------------------------------- */

const FIELD_COLUMNS = `
  reference = $2, district_id = $3, kind = $4, type = $5, status = $6,
  price = $7::numeric, currency = $8, bedrooms = $9, bathrooms = $10,
  built_area = $11, land_area = $12, built_year = $13, parking = $14,
  lat = $15, lng = $16, amenities = $17, listed_at = $18::date
`;

/** The values behind `FIELD_COLUMNS`, in order, after the id. */
function fieldValues(fields: ListingFields): unknown[] {
  return [
    fields.reference,
    fields.districtId,
    fields.kind,
    fields.type,
    fields.status,
    fields.price,
    fields.currency,
    fields.bedrooms,
    fields.bathrooms,
    fields.builtArea,
    fields.landArea,
    fields.builtYear,
    fields.parking,
    fields.lat,
    fields.lng,
    fields.amenities,
    fields.listedAt,
  ];
}

/**
 * Write one language, or remove it.
 *
 * **An `update`-shaped upsert, never delete-and-reinsert**, and AC-5 depends on
 * it: the slug-history trigger fires `after update`, so a listing whose
 * translation row is deleted and written again changes its address with no
 * record that the old one ever existed. Every link the agency has published to
 * that address then 404s. `on conflict … do update` is an UPDATE as far as the
 * trigger is concerned, which is why history keeps itself without the editor
 * remembering anything.
 */
async function writeText(
  tx: Tx,
  id: string,
  locale: Locale,
  text: ListingText | null,
): Promise<void> {
  if (text === null) {
    if (locale === defaultLocale) throw new FrenchRequiredError();
    await tx.query("delete from property_translations where property_id = $1 and locale = $2", [
      id,
      locale,
    ]);
    return;
  }

  try {
    await tx.query(
      `insert into property_translations (property_id, locale, slug, title, description, district, city)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (property_id, locale) do update
         set slug = excluded.slug, title = excluded.title,
             description = excluded.description,
             district = excluded.district, city = excluded.city`,
      [id, locale, text.slug, text.title, text.description, text.district, text.city],
    );
  } catch (error) {
    // Wrapped per language, so the message can name the one that collided.
    if (
      error instanceof PostgresError &&
      error.constraint === "property_translations_locale_slug_key"
    ) {
      throw new SlugTakenError(locale);
    }
    throw asDomainError(error);
  }
}

/**
 * Create a listing as a **draft**, and return its id.
 *
 * Draft is the only state it can be created in: AC-2 requires that a listing
 * she has started and not finished is absent from the catalogue, its own URL,
 * the neighbourhood pages and the sitemap, and the surest way to guarantee that
 * is for "published" to be a separate, deliberate act (`publishListing`).
 *
 * The id is a UUID rather than anything derived. The agency's own reference is
 * the human identity of a listing and it is allowed to be corrected; a primary
 * key derived from it would either drag every foreign key along or quietly stop
 * matching. The seeded listings keep their `p-01` ids for the same reason —
 * a primary key means nothing and should look like it.
 */
export async function createListing(fields: ListingFields, french: ListingText): Promise<string> {
  const id = randomUUID();

  return editorTransaction(async (tx) => {
    try {
      await tx.query(
        `insert into properties (
           id, reference, district_id, kind, type, status, price, currency,
           bedrooms, bathrooms, built_area, land_area, built_year, parking,
           lat, lng, amenities, listed_at, publication
         ) values (
           $1, $2, $3, $4, $5, $6, $7::numeric, $8,
           $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18::date, 'draft'
         )`,
        [id, ...fieldValues(fields)],
      );
    } catch (error) {
      throw asDomainError(error);
    }

    await writeText(tx, id, defaultLocale, french);
    return id;
  });
}

/**
 * Save an existing listing: its fields, and any languages the caller names.
 *
 * Returns the new version, because the form has to carry it into the next save
 * — hand back a stale one and her second save fails against her own first.
 */
export async function saveListing(
  id: string,
  expectedVersion: number,
  fields: ListingFields,
  texts: ListingTexts,
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);

    try {
      await tx.query(`update properties set ${FIELD_COLUMNS} where id = $1`, [
        id,
        ...fieldValues(fields),
      ]);
    } catch (error) {
      throw asDomainError(error);
    }

    for (const [locale, text] of Object.entries(texts)) {
      if (text === undefined) continue;
      await writeText(tx, id, locale as Locale, text);
    }

    return versionOf(tx, id);
  });
}

/**
 * Publish, archive, or send back to draft.
 *
 * One function because they differ by a single value, and separating them would
 * mean three copies of the version check — which is the statement that must not
 * be forgotten.
 *
 * **No completeness check here**, deliberately. Whether the French text is
 * finished enough to publish is a question about a form, answered by a stricter
 * schema in the action (T15) where the answer can name the missing fields. A
 * second, looser copy of that rule down here would be the one that drifts.
 */
async function setPublication(
  id: string,
  expectedVersion: number,
  publication: "draft" | "published" | "archived",
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);

    await tx.query("update properties set publication = $2 where id = $1", [id, publication]);

    return versionOf(tx, id);
  });
}

/** Put it on the website (AC-3). */
export async function publishListing(id: string, expectedVersion: number): Promise<number> {
  return setPublication(id, expectedVersion, "published");
}

/**
 * Take it off the website, keeping everything (AC-4).
 *
 * Archived, never deleted: the enquiries it produced still name it, the
 * addresses it has had still redirect to it, and `belso_editor` has no `delete`
 * on `properties` at all, so this is the only way off the site that exists.
 */
export async function archiveListing(id: string, expectedVersion: number): Promise<number> {
  return setPublication(id, expectedVersion, "archived");
}

/** Back to a draft — the undo for a listing published too early. */
export async function unpublishListing(id: string, expectedVersion: number): Promise<number> {
  return setPublication(id, expectedVersion, "draft");
}

/* -------------------------------------------------------------------------- */
/* Photographs                                                                 */
/* -------------------------------------------------------------------------- */

/** One photograph, already processed and on disk (`media.ts`). */
export type StoredPhotograph = {
  id: string;
  url: string;
  width: number;
  height: number;
};

/**
 * Attach photographs to a listing, at the end of the gallery.
 *
 * Position is computed inside the transaction from what is already there, not
 * passed in: two uploads finishing together would otherwise both be told
 * "position 5" by a caller that read the count a moment earlier, and collide.
 */
export async function addPhotographs(
  id: string,
  expectedVersion: number,
  photographs: readonly StoredPhotograph[],
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);

    const rows = await tx.query<{ next: number }>(
      "select coalesce(max(position), -1) + 1 as next from property_media where property_id = $1",
      [id],
    );
    let position = rows[0]?.next ?? 0;

    for (const photograph of photographs) {
      await tx.query(
        `insert into property_media (id, property_id, url, width, height, position)
         values ($1, $2, $3, $4, $5, $6)`,
        [photograph.id, id, photograph.url, photograph.width, photograph.height, position],
      );
      position += 1;
    }

    return versionOf(tx, id);
  });
}

/**
 * Put the gallery in a new order.
 *
 * **`set constraints … deferred` is what makes this possible at all.** The
 * unique constraint on `(property_id, position)` is checked per row by default,
 * so moving the third photograph to the front fails on the first `update`:
 * something briefly shares a position with something else. Deferring moves the
 * check to commit, so the gallery has to be consistent when the transaction
 * ends rather than at every step inside it (`0005_admin_and_versioning.sql`).
 *
 * The alternative was two passes writing negative positions first. It works, it
 * needs no schema change, and it leaves a table whose positions are briefly
 * nonsense and whose bug reports read like corruption.
 *
 * Only photographs already on this listing are moved, and the `where` says so:
 * the ids arrive from a form.
 */
export async function reorderPhotographs(
  id: string,
  expectedVersion: number,
  orderedMediaIds: readonly string[],
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);

    await tx.query("set constraints property_media_property_id_position_key deferred");

    for (const [position, mediaId] of orderedMediaIds.entries()) {
      await tx.query("update property_media set position = $3 where id = $1 and property_id = $2", [
        mediaId,
        id,
        position,
      ]);
    }

    return versionOf(tx, id);
  });
}

/**
 * Remove a photograph from a listing.
 *
 * The row goes; the files stay on disk. Deleting them here would make an
 * accidental removal unrecoverable, and the originals are the only full-size
 * copies the agency has — sweeping orphans is a job for somebody who has looked
 * at what they are about to delete, not for a click.
 *
 * The remaining photographs are closed up, so positions stay contiguous and a
 * later reorder is not writing into a gap.
 */
export async function removePhotograph(
  id: string,
  expectedVersion: number,
  mediaId: string,
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);
    await tx.query("set constraints property_media_property_id_position_key deferred");

    const removed = await tx.query<{ position: number }>(
      "delete from property_media where id = $1 and property_id = $2 returning position",
      [mediaId, id],
    );

    const gap = removed[0]?.position;
    if (gap !== undefined) {
      await tx.query(
        "update property_media set position = position - 1 where property_id = $1 and position > $2",
        [id, gap],
      );
    }

    return versionOf(tx, id);
  });
}

/**
 * What a photograph shows, in one language.
 *
 * An empty caption **removes the row** rather than storing `""`. `altFor` falls
 * back to another language when a caption is missing and returns `""` only when
 * there is nothing anywhere — so an empty string stored here would silently
 * defeat the fallback and mark the photograph decorative on that language's
 * site, which is the outcome AC-6 exists to prevent.
 */
export async function setAltText(
  id: string,
  expectedVersion: number,
  mediaId: string,
  locale: Locale,
  alt: string,
): Promise<number> {
  return editorTransaction(async (tx) => {
    await lockAtVersion(tx, id, expectedVersion);

    // Scoped to this listing, because `mediaId` arrives from a form.
    const owned = await tx.query<{ id: string }>(
      "select id from property_media where id = $1 and property_id = $2",
      [mediaId, id],
    );
    if (!owned[0]) throw new ListingNotFoundError(mediaId);

    if (alt.trim() === "") {
      await tx.query("delete from property_media_alt where media_id = $1 and locale = $2", [
        mediaId,
        locale,
      ]);
    } else {
      await tx.query(
        `insert into property_media_alt (media_id, locale, alt) values ($1, $2, $3)
         on conflict (media_id, locale) do update set alt = excluded.alt`,
        [mediaId, locale, alt.trim()],
      );
    }

    return versionOf(tx, id);
  });
}
