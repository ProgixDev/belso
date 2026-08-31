"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currencies } from "@/core/currency";
import { type Locale, defaultLocale, isLocale, locales } from "@/core/i18n";
import { requireSession } from "@/core/session";
import { ADMIN_PREFIX } from "@/core/session-cookie";
import { logger } from "@/lib/logger";
import { getListingForEditor } from "./admin-repository";
import { UnsupportedImageError, storeImage } from "./media";
import { districtIds } from "./districts";
import { toSlug } from "./lib";
import { amenities, listingKinds, listingStatuses, propertyTypes } from "./types";
import {
  ConcurrentEditError,
  FrenchRequiredError,
  type ListingText,
  type ListingTexts,
  ListingNotFoundError,
  ReferenceTakenError,
  SlugTakenError,
  addPhotographs,
  archiveListing,
  createListing,
  removePhotograph,
  reorderPhotographs,
  setAltText,
  publishListing,
  saveListing,
  unpublishListing,
} from "./writes";

/**
 * The back-office's Server Actions for the catalogue.
 *
 * **`requireSession()` is the first line of every export here, without
 * exception.** A Server Action is an independently addressable POST endpoint:
 * it is reachable by a forged request without the admin layout ever rendering,
 * so "the layout checked" is not a check for a request that never touched the
 * layout. That makes "did you remember?" a question `grep` can answer, which is
 * the only form of that question anyone reliably asks.
 *
 * **Every failure is returned as a key, never a sentence.** The copy belongs to
 * the component; an action returning French prose would put the back-office's
 * wording in a file the boundary rules say knows nothing about presentation,
 * and would make the same message impossible to reuse or to test by identity.
 */

/* -------------------------------------------------------------------------- */
/* What comes back                                                             */
/* -------------------------------------------------------------------------- */

export type ListingActionError =
  /** A field is missing or malformed; `fields` names which. */
  | "invalid"
  /** Somebody else saved first (AC-10). */
  | "conflict"
  /** The agency reference is already used by another listing. */
  | "referenceTaken"
  /** The address is already used by another listing, in the named language. */
  | "slugTaken"
  /** The listing no longer exists. */
  | "missing"
  /** The file was not an image we can use. */
  | "notAnImage"
  /** The file was larger than a photograph has any need to be. */
  | "tooLarge"
  /** The database did not answer. */
  | "unavailable";

/**
 * Every action takes `(previous, formData)` — the `useActionState` shape.
 *
 * Uniform on purpose. Two of these are driven by a long form that has to show
 * what went wrong, and three are one-click buttons; giving the buttons the
 * shorter signature would save a parameter and cost the ability to report a
 * refused publish. And `useActionState` on a real Server Action is what keeps
 * the editor submitting **before hydration** — the same reason the enquiry form
 * is built this way. A client-side wrapper would look identical and quietly
 * require JavaScript.
 */
export type ListingActionResult =
  | { ok: true; id: string; version: number }
  | {
      ok: false;
      error: ListingActionError;
      /** Field names the client has to fix, for `invalid`. Keys, not sentences. */
      fields?: string[];
      /** Which language collided, for `slugTaken`. */
      locale?: Locale;
    };

/* -------------------------------------------------------------------------- */
/* Schemas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `numeric(14,2)` as text, all the way through.
 *
 * Validated as a string rather than coerced to a number: parsing an asking
 * price into a float and formatting it back is exactly the round trip the
 * column type exists to avoid. A comma is accepted and normalised because a
 * French keyboard produces one and refusing it would be pedantry.
 */
const priceSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "price");

const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "integer");

const requiredInt = z
  .string()
  .trim()
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v >= 0, "integer");

const optionalFloat = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "number");

/**
 * What a **save** requires, which is deliberately little.
 *
 * AC-2 is that a listing she has started and not finished is saved anyway. An
 * estate agent writes a listing over a morning, with the photographer still to
 * send the pictures and the description half-formed; a form that refuses to
 * save until it is perfect is a form that loses the morning's work. So the
 * floor here is only what makes a coherent database row.
 */
const fieldsSchema = z.object({
  reference: z.string().trim().min(1),
  districtId: z.enum(districtIds),
  kind: z.enum(listingKinds),
  type: z.enum(propertyTypes),
  status: z.enum(listingStatuses),
  price: priceSchema,
  currency: z.enum(currencies),
  bedrooms: requiredInt,
  bathrooms: requiredInt,
  builtArea: requiredInt,
  landArea: optionalInt,
  builtYear: optionalInt,
  parking: requiredInt,
  lat: optionalFloat,
  lng: optionalFloat,
  amenities: z.array(z.enum(amenities)),
  listedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
});

const textSchema = z.object({
  slug: z.string().trim(),
  title: z.string().trim(),
  description: z.string().trim(),
  district: z.string().trim(),
  city: z.string().trim(),
});

/**
 * What **publishing** requires, which is everything a visitor will read.
 *
 * A strictly stronger schema than the one above, and the gap between them is
 * the whole design: an incomplete listing is a legitimate state to be in and an
 * illegitimate state to be *on the website in*. Checked against the stored
 * listing rather than the form, because publishing happens from the listing
 * index where there is no form — and because what matters is what is saved.
 *
 * French only. English stays optional, by decision (spec 011): the site already
 * shows French text with an honest note when a translation is missing, and
 * holding a finished property off the site until somebody translates it is
 * worse for the agency than the note is.
 */
const publishableSchema = z.object({
  reference: z.string().trim().min(1),
  price: z.number().positive(),
  builtArea: z.number().positive(),
  fr: z.object({
    slug: z.string().trim().min(1),
    title: z.string().trim().min(1),
    // Long enough to be a description rather than a placeholder. The number is
    // a judgement, not a standard: it is roughly one sentence.
    description: z.string().trim().min(40),
    district: z.string().trim().min(1),
    city: z.string().trim().min(1),
  }),
});

/* -------------------------------------------------------------------------- */
/* Form reading                                                                */
/* -------------------------------------------------------------------------- */

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readFields(formData: FormData) {
  return fieldsSchema.safeParse({
    reference: read(formData, "reference"),
    districtId: read(formData, "districtId"),
    kind: read(formData, "kind"),
    type: read(formData, "type"),
    status: read(formData, "status"),
    price: read(formData, "price"),
    currency: read(formData, "currency"),
    bedrooms: read(formData, "bedrooms"),
    bathrooms: read(formData, "bathrooms"),
    builtArea: read(formData, "builtArea"),
    landArea: read(formData, "landArea"),
    builtYear: read(formData, "builtYear"),
    parking: read(formData, "parking"),
    lat: read(formData, "lat"),
    lng: read(formData, "lng"),
    amenities: formData.getAll("amenities").filter((v) => typeof v === "string"),
    listedAt: read(formData, "listedAt"),
  });
}

/**
 * One language's group of boxes, turned into an intention.
 *
 * **An entirely empty group means "no row", not "empty strings"** (AC-3b, T18).
 * A form always submits every field it renders, so without this an untouched
 * English group would write a translation whose title is `""` — putting the
 * listing on the English site with a blank heading and *no* untranslated note,
 * because as far as the site is concerned a translation exists. The honest note
 * is the better outcome, and it only appears when the row is absent.
 *
 * French is exempt: it is never absent, and an empty French group is a
 * validation failure rather than a removal.
 */
function readText(formData: FormData, locale: Locale): ListingText | null {
  const text = {
    slug: read(formData, `${locale}.slug`),
    title: read(formData, `${locale}.title`),
    description: read(formData, `${locale}.description`),
    district: read(formData, `${locale}.district`),
    city: read(formData, `${locale}.city`),
  };

  const empty = Object.values(text).every((value) => value.trim() === "");
  if (empty) return locale === defaultLocale ? { ...text } : null;

  const parsed = textSchema.parse(text);
  // Derived only when she has not written one, so the address is never renamed
  // behind her back on a save (`toSlug`).
  return { ...parsed, slug: parsed.slug || toSlug(parsed.title) };
}

/** Zod's issue paths, flattened into the field names the form uses. */
function fieldNames(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];
}

/**
 * Every expected database failure, turned into a key.
 *
 * Anything unrecognised is re-thrown rather than folded into `unavailable`: an
 * error nobody has thought about should reach the error boundary and be
 * visible, not be quietly relabelled as a database outage and disappear into a
 * message the client cannot act on.
 */
function asResult(error: unknown): ListingActionResult {
  if (error instanceof ConcurrentEditError) return { ok: false, error: "conflict" };
  if (error instanceof ReferenceTakenError) return { ok: false, error: "referenceTaken" };
  if (error instanceof SlugTakenError) {
    return { ok: false, error: "slugTaken", locale: error.locale };
  }
  if (error instanceof ListingNotFoundError) return { ok: false, error: "missing" };
  if (error instanceof FrenchRequiredError) return { ok: false, error: "invalid", fields: ["fr"] };

  throw error;
}

/**
 * Tell the public site that the catalogue changed.
 *
 * **The whole tree, not a list of paths**, and the reason is spec 010's review.
 * A listing appears on its own page in two languages, in the catalogue index, on
 * its neighbourhood page, on the home page, and in the sitemap — and the
 * sitemap is the one that was missed, which is how sixty fixture URLs were
 * handed to Google. Any enumeration here is a list somebody has to remember to
 * extend the next time a page starts reading the catalogue, and the cost of
 * being blunt is a few rebuilt pages on a site with twenty listings and three
 * editors.
 *
 * Today this is close to a no-op: every catalogue-reading route declares
 * `force-dynamic`, so nothing about them is cached to invalidate. That is
 * deliberate — spec 010 chose correctness over caching until a write path
 * existed. This is the other half of that trade arriving, so those routes can
 * become `revalidate`-based without anyone having to remember to add this call
 * at the same time.
 */
function refreshPublicSite(): void {
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* The actions                                                                 */
/* -------------------------------------------------------------------------- */

/** Create a draft from the new-listing form. */
export async function createListingAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const fields = readFields(formData);
  const french = readText(formData, defaultLocale);

  const problems = fields.success ? [] : fieldNames(fields.error);
  // `readText` never returns null for French — an empty French group is a
  // validation failure, not a removal — but the type says it might, and a
  // narrowing that depends on reading another function is the kind that stops
  // being true when that function changes.
  if (!french || french.title.trim() === "") problems.push("fr.title");

  if (!fields.success || !french || problems.length > 0) {
    return { ok: false, error: "invalid", fields: problems };
  }

  const text: ListingText = { ...french, slug: french.slug || toSlug(french.title) };

  let id: string;
  try {
    id = await createListing(fields.data, text);
    refreshPublicSite();
  } catch (error) {
    return asResult(error);
  }

  /*
   * Straight to the listing she just made, and outside the `try` because
   * `redirect()` works by throwing — inside, it would be caught above and
   * reported as a database failure.
   *
   * Returning `{ ok: true }` instead was the first version, and the screenshot
   * showed why it was wrong: the form cleared itself and said "Enregistré." on
   * a page still titled "Nouveau bien", with no link to what had been created.
   * It reads as a failure, and the obvious response — press the button again —
   * makes a second listing.
   */
  redirect(`${ADMIN_PREFIX}/listings/${id}`);
}

/** Save an existing listing. Incomplete is allowed; that is AC-2. */
export async function saveListingAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  if (!id || !Number.isInteger(version)) return { ok: false, error: "invalid", fields: ["id"] };

  const fields = readFields(formData);
  if (!fields.success) {
    return { ok: false, error: "invalid", fields: fieldNames(fields.error) };
  }

  const texts: ListingTexts = {};
  for (const locale of locales) texts[locale] = readText(formData, locale);

  try {
    const next = await saveListing(id, version, fields.data, texts);
    refreshPublicSite();
    return { ok: true, id, version: next };
  } catch (error) {
    return asResult(error);
  }
}

/**
 * Publish, if the listing is finished enough to be read by a stranger.
 *
 * The completeness check runs **against the stored listing**, not against a
 * form: publishing happens from the listing index where there is no form, and
 * what a visitor will see is what is saved rather than what is on somebody's
 * screen.
 */
export async function publishListingAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  if (!id || !Number.isInteger(version)) return { ok: false, error: "invalid", fields: ["id"] };

  const listing = await getListingForEditor(id);
  if (!listing) return { ok: false, error: "missing" };
  if (listing.version !== version) return { ok: false, error: "conflict" };

  const check = publishableSchema.safeParse({
    reference: listing.reference,
    price: listing.price,
    builtArea: listing.builtArea,
    fr: listing.translations[defaultLocale] ?? {},
  });

  if (!check.success) {
    // Named, not counted: "publishing is refused and the missing fields are
    // named" is the second half of AC-3, and a bare refusal fails it.
    return { ok: false, error: "invalid", fields: fieldNames(check.error) };
  }

  try {
    const next = await publishListing(id, version);
    refreshPublicSite();
    logger.info("listing published", { id });
    return { ok: true, id, version: next };
  } catch (error) {
    return asResult(error);
  }
}

/** Take a listing off the site, keeping everything (AC-4). */
export async function archiveListingAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();
  return changePublication(formData, archiveListing);
}

/** Put a published listing back into draft — the undo for publishing early. */
export async function unpublishListingAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();
  return changePublication(formData, unpublishListing);
}

/**
 * Shared tail of the two state changes that need no validation.
 *
 * **Not exported**, and not a Server Action. It takes the session as already
 * checked because its two callers check it on their own first line — which is
 * only safe because nothing else can reach this function. A helper that
 * authorised on behalf of its callers would be the thing everyone forgets to
 * call.
 */
async function changePublication(
  formData: FormData,
  change: (id: string, version: number) => Promise<number>,
): Promise<ListingActionResult> {
  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  if (!id || !Number.isInteger(version)) return { ok: false, error: "invalid", fields: ["id"] };

  try {
    const version_ = await change(id, version);
    refreshPublicSite();
    return { ok: true, id, version: version_ };
  } catch (error) {
    return asResult(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Photographs (AC-6)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The ceiling on one photograph.
 *
 * Sixteen megabytes is generous for a full-frame RAW-derived JPEG and refuses a
 * video somebody dragged in by mistake. It has to stay under
 * `serverActions.bodySizeLimit` in `next.config.ts`, which is the limit that
 * actually protects the box — this one exists so the refusal has a message
 * rather than being a truncated request.
 *
 * **Photographs are uploaded one per submission**, which is why one file's size
 * is the whole budget. Fifteen at once would be a two-hundred-megabyte body
 * buffered in memory on a two-core machine that also runs Postgres, and the
 * upload of a gallery would take the public site down with it.
 */
const MAX_BYTES = 16 * 1024 * 1024;

/** Add one photograph to a listing. */
export async function uploadPhotographAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  if (!id || !Number.isInteger(version)) return { ok: false, error: "invalid", fields: ["id"] };

  const file = formData.get("photograph");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "invalid", fields: ["photograph"] };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "tooLarge" };

  try {
    /*
     * Decoded and written before the row exists. A file on disk with no row is
     * an orphan somebody has to sweep; a row pointing at a file that was never
     * written is a broken image on the client's website, which is worse.
     */
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()));
    const next = await addPhotographs(id, version, [stored]);
    refreshPublicSite();
    return { ok: true, id, version: next };
  } catch (error) {
    if (error instanceof UnsupportedImageError) return { ok: false, error: "notAnImage" };
    return asResult(error);
  }
}

/** Put the gallery in the order the form describes. */
export async function reorderPhotographsAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  if (!id || !Number.isInteger(version)) return { ok: false, error: "invalid", fields: ["id"] };

  const order = formData
    .getAll("order")
    .filter((value): value is string => typeof value === "string");

  try {
    const next = await reorderPhotographs(id, version, order);
    refreshPublicSite();
    return { ok: true, id, version: next };
  } catch (error) {
    return asResult(error);
  }
}

/** Take one photograph off a listing. The files stay on disk. */
export async function removePhotographAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  const mediaId = read(formData, "mediaId");
  if (!id || !mediaId || !Number.isInteger(version)) {
    return { ok: false, error: "invalid", fields: ["id"] };
  }

  try {
    const next = await removePhotograph(id, version, mediaId);
    refreshPublicSite();
    return { ok: true, id, version: next };
  } catch (error) {
    return asResult(error);
  }
}

/** Write what a photograph shows, in one language. */
export async function saveAltTextAction(
  _previous: ListingActionResult | null,
  formData: FormData,
): Promise<ListingActionResult> {
  await requireSession();

  const id = read(formData, "id");
  const version = Number(read(formData, "version"));
  const mediaId = read(formData, "mediaId");
  const locale = read(formData, "locale");
  if (!id || !mediaId || !Number.isInteger(version) || !isLocale(locale)) {
    return { ok: false, error: "invalid", fields: ["id"] };
  }

  try {
    const next = await setAltText(id, version, mediaId, locale, read(formData, "alt"));
    refreshPublicSite();
    return { ok: true, id, version: next };
  } catch (error) {
    return asResult(error);
  }
}
