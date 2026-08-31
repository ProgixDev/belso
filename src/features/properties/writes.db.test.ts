import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The write path, against real Postgres (AC-2, AC-4, AC-5, AC-10).
 *
 * Mocked, none of this would mean anything: every property under test belongs
 * to the database rather than to us. The version is moved by a trigger, the
 * slug history is written by another, the concurrency check depends on `for
 * update` actually blocking a second transaction, and the constraint mapping
 * depends on Postgres raising `23505` with the constraint name we expect. A
 * fake would return what it was told to return.
 *
 * Writes, so it lives in `pnpm test:db`, which refuses any database not named
 * for testing. Every listing it creates is removed afterwards — as the owner,
 * because `belso_editor` deliberately cannot delete a listing (AC-4), and
 * cleaning up a fixture is the harness's job rather than an argument for a
 * grant the application must never have.
 */

const configured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_EDITOR_URL);

/** Unique per test run, so a crashed run cannot collide with the next one. */
const stamp = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const created: string[] = [];

async function fields(mark: string) {
  const { districtIds } = await import("./districts");
  return {
    reference: `TEST-${mark}`,
    districtId: districtIds[0],
    kind: "sale" as const,
    type: "villa" as const,
    status: "available" as const,
    // A string, not a number: the column is numeric and money is not a float.
    price: "4250000.00",
    currency: "MAD" as const,
    bedrooms: 4,
    bathrooms: 3,
    builtArea: 320,
    landArea: 1200,
    builtYear: 2019,
    parking: 2,
    lat: null,
    lng: null,
    amenities: ["pool" as const, "garden" as const],
    listedAt: "2026-08-01",
  };
}

function text(mark: string, prefix = "villa") {
  return {
    slug: `${prefix}-${mark}`,
    title: `Villa d’essai ${mark}`,
    description: "Une description assez longue pour ressembler à une vraie annonce.",
    district: "Palmeraie",
    city: "Marrakech",
  };
}

/** Create a draft and remember it for teardown. */
async function makeDraft(mark: string) {
  const { createListing } = await import("./writes");
  const id = await createListing(await fields(mark), text(mark));
  created.push(id);
  return id;
}

async function versionOf(id: string): Promise<number> {
  const { query } = await import("@/core/db");
  const rows = await query<{ version: number }>("select version from properties where id = $1", [
    id,
  ]);
  return rows[0]?.version ?? -1;
}

beforeEach(() => {
  created.length = 0;
});

afterEach(async () => {
  if (created.length === 0) return;
  const { query } = await import("@/core/db");
  await query("delete from properties where id = any($1::text[])", [created]);
});

describe.skipIf(!configured)("createListing", () => {
  it("creates a draft, never a published listing (AC-2)", async () => {
    const { query } = await import("@/core/db");
    const id = await makeDraft(stamp());

    const rows = await query<{ publication: string }>(
      "select publication from properties where id = $1",
      [id],
    );

    /*
     * Publishing is a separate, deliberate act. If creation could publish, a
     * half-written listing would be one mis-click from the public catalogue —
     * and AC-2 lists five surfaces it must be absent from.
     */
    expect(rows[0]?.publication).toBe("draft");
  });

  it("writes the French text with it", async () => {
    const { query } = await import("@/core/db");
    const mark = stamp();
    const id = await makeDraft(mark);

    const rows = await query<{ locale: string; slug: string }>(
      "select locale, slug from property_translations where property_id = $1",
      [id],
    );

    // French only: English is optional and arrives later, without republishing.
    expect(rows).toEqual([{ locale: "fr", slug: `villa-${mark}` }]);
  });

  it("refuses a reference another listing already uses", async () => {
    const { createListing, ReferenceTakenError } = await import("./writes");
    const mark = stamp();
    await makeDraft(mark);

    // Every enquiry quotes the reference; two listings sharing one makes every
    // enquiry about either of them ambiguous.
    await expect(
      createListing(await fields(mark), text(`${mark}b`, "autre")),
    ).rejects.toBeInstanceOf(ReferenceTakenError);
  });

  it("refuses an address another listing already uses, and writes nothing", async () => {
    const { createListing, SlugTakenError } = await import("./writes");
    const { query } = await import("@/core/db");
    const mark = stamp();
    await makeDraft(mark);

    const clash = { ...(await fields(`${mark}b`)) };
    await expect(createListing(clash, text(mark))).rejects.toBeInstanceOf(SlugTakenError);

    /*
     * The transaction is the point of this assertion. The property row is
     * inserted before the translation, so without a rollback the failed create
     * would leave a listing with a reference, a price and no text at all —
     * visible in the editor, impossible to publish, and puzzling.
     */
    const orphans = await query<{ n: number }>(
      "select count(*)::int as n from properties where reference = $1",
      [clash.reference],
    );
    expect(orphans[0]?.n).toBe(0);
  });
});

describe.skipIf(!configured)("saveListing", () => {
  it("moves the version, so the next save has something to check against", async () => {
    const { saveListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    const before = await versionOf(id);

    const after = await saveListing(id, before, { ...(await fields(mark)), bedrooms: 6 }, {});

    expect(after).toBeGreaterThan(before);
    // And the returned version is the real one, not an optimistic guess.
    expect(after).toBe(await versionOf(id));
  });

  it("adds English later without touching the French (AC-3b)", async () => {
    const { query } = await import("@/core/db");
    const { saveListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    const french = await query<{ slug: string; title: string; description: string }>(
      "select slug, title, description from property_translations where property_id = $1 and locale = 'fr'",
      [id],
    );

    await saveListing(id, await versionOf(id), await fields(mark), {
      en: { ...text(mark, "villa-en"), title: `Test villa ${mark}` },
    });

    const after = await query<{ slug: string; title: string; description: string }>(
      "select slug, title, description from property_translations where property_id = $1 and locale = 'fr'",
      [id],
    );

    // Byte-identical: adding a translation must not disturb the page that was
    // already correct, which is the half of AC-3b that is easy to miss.
    expect(after).toEqual(french);
  });

  it("removes a language when told to, and refuses to remove French", async () => {
    const { query } = await import("@/core/db");
    const { saveListing, FrenchRequiredError } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    await saveListing(id, await versionOf(id), await fields(mark), {
      en: text(mark, "villa-en"),
    });
    await saveListing(id, await versionOf(id), await fields(mark), { en: null });

    const locales = await query<{ locale: string }>(
      "select locale from property_translations where property_id = $1",
      [id],
    );
    expect(locales.map((r) => r.locale)).toEqual(["fr"]);

    // French is what a listing *is* here — removing it would leave a row the
    // public site cannot render in any language.
    await expect(
      saveListing(id, await versionOf(id), await fields(mark), { fr: null }),
    ).rejects.toBeInstanceOf(FrenchRequiredError);
  });

  it("records the old address when the slug changes (AC-5)", async () => {
    const { query } = await import("@/core/db");
    const { saveListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    await saveListing(id, await versionOf(id), await fields(mark), {
      fr: text(mark, "villa-renommee"),
    });

    const history = await query<{ slug: string }>(
      "select slug from property_slug_history where property_id = $1",
      [id],
    );

    /*
     * Written by the trigger from 0002, not by this code — which only works
     * because `writeText` upserts rather than deleting and re-inserting. A
     * delete-and-insert changes the address with no record that the old one
     * existed, and every link the agency has published to it 404s.
     */
    expect(history.map((r) => r.slug)).toEqual([`villa-${mark}`]);
  });
});

describe.skipIf(!configured)("publication", () => {
  it("publishes, archives, and keeps everything when it archives (AC-4)", async () => {
    const { query } = await import("@/core/db");
    const { archiveListing, publishListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    await publishListing(id, await versionOf(id));
    expect(await publicationOf(id)).toBe("published");

    await archiveListing(id, await versionOf(id));
    expect(await publicationOf(id)).toBe("archived");

    // "Off the site" is not "gone": the enquiries it produced still name it and
    // the addresses it has had still redirect to it.
    const kept = await query<{ translations: number }>(
      "select count(*)::int as translations from property_translations where property_id = $1",
      [id],
    );
    expect(kept[0]?.translations).toBe(1);
  });

  async function publicationOf(id: string): Promise<string> {
    const { query } = await import("@/core/db");
    const rows = await query<{ publication: string }>(
      "select publication from properties where id = $1",
      [id],
    );
    return rows[0]?.publication ?? "missing";
  }
});

describe.skipIf(!configured)("concurrent edits (AC-10)", () => {
  it("tells the second person rather than losing the first person's work", async () => {
    const { query } = await import("@/core/db");
    const { ConcurrentEditError, saveListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    // Both open the listing at the same moment, so both forms carry this.
    const loaded = await versionOf(id);

    await saveListing(id, loaded, { ...(await fields(mark)), bedrooms: 9 }, {});

    await expect(
      saveListing(id, loaded, { ...(await fields(mark)), bedrooms: 2 }, {}),
    ).rejects.toBeInstanceOf(ConcurrentEditError);

    /*
     * The half that matters more than the error: the first person's work is
     * still there. A check that reports a conflict *after* overwriting would
     * satisfy a careless reading of AC-10 and lose the edit anyway.
     */
    const rows = await query<{ bedrooms: number }>(
      "select bedrooms from properties where id = $1",
      [id],
    );
    expect(rows[0]?.bedrooms).toBe(9);
  });

  it("refuses two simultaneous saves, not merely two sequential ones", async () => {
    const { ConcurrentEditError, saveListing } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    const loaded = await versionOf(id);

    /*
     * **Both connections are opened before either transaction starts, and
     * without this the test is worthless.**
     *
     * It was, at first. Timing the two saves showed the second one waiting
     * 330ms for a connection — opening one through the SSH tunnel takes longer
     * than the whole first transaction — so the pool handed them out one after
     * the other and the two never overlapped at all. The test passed with the
     * row lock deleted, which means it was proving that two *sequential* saves
     * conflict: the easy half, and not the half AC-10 is about.
     *
     * Two concurrent no-op transactions force the pool to open two connections
     * and hand them back idle. The real pair then takes both immediately and
     * genuinely runs at the same time.
     *
     * The arguments are built up front for the same reason: an `await` inside
     * the array literal suspends between the two calls, which is another way to
     * accidentally serialise them.
     */
    const { editorTransaction } = await import("@/core/db");
    await Promise.all([
      editorTransaction(async (tx) => tx.query("select 1")),
      editorTransaction(async (tx) => tx.query("select 1")),
    ]);

    const base = await fields(mark);
    const results = await Promise.allSettled([
      saveListing(id, loaded, { ...base, bedrooms: 5 }, {}),
      saveListing(id, loaded, { ...base, bedrooms: 7 }, {}),
    ]);

    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConcurrentEditError);
  });

  it("refuses a save against a listing that no longer exists", async () => {
    const { ListingNotFoundError, saveListing } = await import("./writes");
    const mark = stamp();

    await expect(saveListing("no-such-listing", 1, await fields(mark), {})).rejects.toBeInstanceOf(
      ListingNotFoundError,
    );
  });
});

describe.skipIf(!configured)("photographs (AC-6)", () => {
  /** Three photographs, already "processed" — `media.test.ts` covers the pipeline. */
  const frames = (mark: string) =>
    [1, 2, 3].map((n) => ({
      id: `${mark}-${n}`,
      url: `/media/${mark}-${n}/master.webp`,
      width: 2560,
      height: 1707,
    }));

  async function positions(id: string) {
    const { query } = await import("@/core/db");
    return query<{ id: string; position: number }>(
      "select id, position from property_media where property_id = $1 order by position",
      [id],
    );
  }

  it("appends to the end of the gallery, computing the position itself", async () => {
    const { addPhotographs } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);

    await addPhotographs(id, await versionOf(id), frames(mark).slice(0, 2));
    await addPhotographs(id, await versionOf(id), frames(mark).slice(2));

    /*
     * The position is computed inside the transaction rather than passed in:
     * two uploads finishing together would otherwise both be told "position 2"
     * by a caller that counted a moment earlier, and collide.
     */
    expect((await positions(id)).map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("reorders in a single pass, which only works with the constraint deferred", async () => {
    const { addPhotographs, reorderPhotographs } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    await addPhotographs(id, await versionOf(id), frames(mark));

    /*
     * Moving the third photograph to the front. Checked per row — the default —
     * the very first `update` fails, because something briefly shares a
     * position with something else. This passing is the deferred constraint
     * from `0005_admin_and_versioning.sql` doing its job.
     */
    await reorderPhotographs(id, await versionOf(id), [`${mark}-3`, `${mark}-1`, `${mark}-2`]);

    expect((await positions(id)).map((r) => r.id)).toEqual([`${mark}-3`, `${mark}-1`, `${mark}-2`]);
  });

  it("closes the gap when a photograph is removed", async () => {
    const { addPhotographs, removePhotograph } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    await addPhotographs(id, await versionOf(id), frames(mark));

    await removePhotograph(id, await versionOf(id), `${mark}-1`);

    // Contiguous, so a later reorder is not writing into a hole.
    const after = await positions(id);
    expect(after.map((r) => r.position)).toEqual([0, 1]);
    expect(after.map((r) => r.id)).toEqual([`${mark}-2`, `${mark}-3`]);
  });

  it("stores a caption per language, and removes the row when one is cleared", async () => {
    const { query } = await import("@/core/db");
    const { addPhotographs, setAltText } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    await addPhotographs(id, await versionOf(id), frames(mark).slice(0, 1));

    await setAltText(id, await versionOf(id), `${mark}-1`, "fr", "La piscine au crépuscule");
    await setAltText(id, await versionOf(id), `${mark}-1`, "en", "The pool at dusk");
    await setAltText(id, await versionOf(id), `${mark}-1`, "en", "   ");

    const rows = await query<{ locale: string; alt: string }>(
      "select locale, alt from property_media_alt where media_id = $1",
      [`${mark}-1`],
    );

    /*
     * Cleared means **gone**, not `""`. `altFor` falls back to another language
     * when a caption is absent and returns `""` only when there is nothing
     * anywhere — so an empty string stored here would silently defeat the
     * fallback and mark the photograph decorative on the English site, which is
     * the exact regression T13 was fixed to prevent.
     */
    expect(rows).toEqual([{ locale: "fr", alt: "La piscine au crépuscule" }]);
  });

  it("refuses to caption a photograph belonging to another listing", async () => {
    const { addPhotographs, setAltText, ListingNotFoundError } = await import("./writes");
    const mine = stamp();
    const theirs = stamp();
    const mineId = await makeDraft(mine);
    const theirsId = await makeDraft(theirs);
    await addPhotographs(theirsId, await versionOf(theirsId), frames(theirs).slice(0, 1));

    // The media id arrives from a form, so ownership is checked rather than
    // assumed.
    await expect(
      setAltText(mineId, await versionOf(mineId), `${theirs}-1`, "fr", "Pas la mienne"),
    ).rejects.toBeInstanceOf(ListingNotFoundError);
  });

  it("moves the listing's version, so the editor stays in step", async () => {
    const { addPhotographs } = await import("./writes");
    const mark = stamp();
    const id = await makeDraft(mark);
    const before = await versionOf(id);

    const after = await addPhotographs(id, before, frames(mark).slice(0, 1));

    // The trigger on `property_media` touches the parent, so a page that kept
    // using the version it was rendered with would refuse her next click as
    // somebody else's edit — with her as the somebody else.
    expect(after).toBeGreaterThan(before);
  });
});
