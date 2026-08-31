import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The catalogue's Server Actions, against a faked write path.
 *
 * Two things are worth testing here and the database is not one of them —
 * `writes.db.test.ts` covers that. What this file pins is the layer above:
 *
 * - **Every export authorises before it writes** (AC-1). Not "is protected by
 *   the layout": an action is reachable without the layout ever rendering, so
 *   the check has to be in the action and something has to prove it is.
 * - **Publishing is stricter than saving** (AC-2, AC-3). An incomplete listing
 *   must save happily and refuse to publish, naming what is missing — a bare
 *   refusal fails the second half of AC-3.
 */

const mocks = vi.hoisted(() => {
  /** Everything that happened, in order, so "before" can be asserted. */
  const calls: string[] = [];
  const track =
    <T>(name: string, result: T) =>
    () => {
      calls.push(name);
      return Promise.resolve(result);
    };

  return {
    calls,
    track,
    requireSession: vi.fn(() => {
      calls.push("requireSession");
      return Promise.resolve({ userId: "u-1", email: "s@belso.ma", displayName: "Sofia" });
    }),
    createListing: vi.fn<(...args: unknown[]) => Promise<string>>(),
    saveListing: vi.fn<(...args: unknown[]) => Promise<number>>(),
    publishListing: vi.fn<(...args: unknown[]) => Promise<number>>(),
    archiveListing: vi.fn<(...args: unknown[]) => Promise<number>>(),
    unpublishListing: vi.fn<(...args: unknown[]) => Promise<number>>(),
    getListingForEditor: vi.fn<(id: string) => Promise<unknown>>(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/core/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    // `redirect()` throws in Next, and `createListingAction` depends on that:
    // there is no success value to return once it lands on the new listing.
    throw new Error(`REDIRECT ${path}`);
  },
}));
vi.mock("./admin-repository", () => ({ getListingForEditor: mocks.getListingForEditor }));

vi.mock("./writes", async (importOriginal) => {
  // The error classes are real — the actions map them by `instanceof`, and a
  // fake hierarchy would let a broken mapping pass.
  const actual = await importOriginal<typeof import("./writes")>();
  return {
    ...actual,
    createListing: mocks.createListing,
    saveListing: mocks.saveListing,
    publishListing: mocks.publishListing,
    archiveListing: mocks.archiveListing,
    unpublishListing: mocks.unpublishListing,
  };
});

/** A form with everything a save needs, before any test spoils part of it. */
function completeForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    id: "p-test",
    version: "3",
    reference: "BL-9001",
    districtId: "palmeraie",
    kind: "sale",
    type: "villa",
    status: "available",
    price: "4250000",
    currency: "MAD",
    bedrooms: "4",
    bathrooms: "3",
    builtArea: "320",
    landArea: "",
    builtYear: "",
    parking: "2",
    lat: "",
    lng: "",
    listedAt: "2026-08-01",
    "fr.slug": "villa-essai",
    "fr.title": "Villa d’essai",
    "fr.description": "Une description assez longue pour ressembler à une vraie annonce.",
    "fr.district": "Palmeraie",
    "fr.city": "Marrakech",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) data.append(key, value);
  return data;
}

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.requireSession.mockClear();
  mocks.createListing.mockReset().mockImplementation(mocks.track("createListing", "new-id"));
  mocks.saveListing.mockReset().mockImplementation(mocks.track("saveListing", 4));
  mocks.publishListing.mockReset().mockImplementation(mocks.track("publishListing", 4));
  mocks.archiveListing.mockReset().mockImplementation(mocks.track("archiveListing", 4));
  mocks.unpublishListing.mockReset().mockImplementation(mocks.track("unpublishListing", 4));
  mocks.getListingForEditor.mockReset();
  mocks.revalidatePath.mockClear();
});

describe("AC-1: every action authorises itself", () => {
  it("checks the session before it writes anything, on every export", async () => {
    const actions = await import("./admin-actions");
    mocks.getListingForEditor.mockResolvedValue({
      version: 3,
      reference: "BL-9001",
      price: 4250000,
      builtArea: 320,
      translations: {
        fr: {
          slug: "villa-essai",
          title: "Villa d’essai",
          description: "Une description assez longue pour ressembler à une vraie annonce.",
          district: "Palmeraie",
          city: "Marrakech",
        },
      },
    });

    const everyExport = [
      actions.createListingAction,
      actions.saveListingAction,
      actions.publishListingAction,
      actions.archiveListingAction,
      actions.unpublishListingAction,
    ];

    for (const action of everyExport) {
      mocks.calls.length = 0;
      // `createListingAction` ends in a redirect, which throws by design.
      await action(null, completeForm()).catch(() => undefined);

      /*
       * The assertion is the *order*, not the count. An action that
       * authorises after writing has authorised nothing — and that is a real
       * shape, not a hypothetical one: it is what happens when somebody adds
       * the check to the end of a function while fixing something else.
       */
      expect(mocks.calls[0], `${action.name} wrote before it checked`).toBe("requireSession");
    }
  });
});

describe("saving is permissive (AC-2)", () => {
  it("saves a listing with no description and no English at all", async () => {
    const { saveListingAction } = await import("./admin-actions");

    const result = await saveListingAction(null, completeForm({ "fr.description": "" }));

    /*
     * An agent writes a listing over a morning, with the photographer still to
     * send the pictures. A form that refuses to save until it is perfect loses
     * the morning's work — which is why the save schema is the loose one.
     */
    expect(result).toEqual({ ok: true, id: "p-test", version: 4 });
  });

  it("writes no English row at all when the English boxes are untouched (AC-3b)", async () => {
    const { saveListingAction } = await import("./admin-actions");

    await saveListingAction(null, completeForm());

    const texts = mocks.saveListing.mock.calls[0]?.[3] as Record<string, unknown>;
    /*
     * `null`, not an object of empty strings. A form submits every field it
     * renders, so an untouched English group would otherwise write a
     * translation whose title is `""` — putting the listing on the English site
     * with a blank heading and *no* untranslated note, because as far as the
     * site is concerned a translation exists.
     */
    expect(texts.en).toBeNull();
    expect(texts.fr).toMatchObject({ title: "Villa d’essai" });
  });

  it("derives an address from the title only when she has not written one", async () => {
    const { saveListingAction } = await import("./admin-actions");

    await saveListingAction(null, completeForm({ "fr.slug": "" }));
    const derived = mocks.saveListing.mock.calls[0]?.[3] as { fr: { slug: string } };
    // `Villa d’essai` → `villa-d-essai`: the apostrophe is a separator, not a
    // character to delete. `villa-dessai` would read as a different word.
    expect(derived.fr.slug).toBe("villa-d-essai");

    mocks.saveListing.mockClear();
    await saveListingAction(null, completeForm({ "fr.slug": "adresse-choisie" }));
    const kept = mocks.saveListing.mock.calls[0]?.[3] as { fr: { slug: string } };
    // Re-deriving on every save would rename listings behind her back, and each
    // rename retires an address that links already point at (AC-5).
    expect(kept.fr.slug).toBe("adresse-choisie");
  });

  it("refuses a price that is not a price, without touching the database", async () => {
    const { saveListingAction } = await import("./admin-actions");

    const result = await saveListingAction(null, completeForm({ price: "quatre millions" }));

    expect(result).toEqual({ ok: false, error: "invalid", fields: ["price"] });
    expect(mocks.saveListing).not.toHaveBeenCalled();
  });

  it("accepts a price typed on a French keyboard", async () => {
    const { saveListingAction } = await import("./admin-actions");

    await saveListingAction(null, completeForm({ price: "4 250 000,50" }));

    const fields = mocks.saveListing.mock.calls[0]?.[2] as { price: string };
    // A string all the way down: parsing an asking price into a float and back
    // is the round trip the numeric column exists to avoid.
    expect(fields.price).toBe("4250000.50");
  });
});

describe("publishing is strict (AC-3)", () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    version: 3,
    reference: "BL-9001",
    price: 4250000,
    builtArea: 320,
    translations: {
      fr: {
        slug: "villa-essai",
        title: "Villa d’essai",
        description: "Une description assez longue pour ressembler à une vraie annonce.",
        district: "Palmeraie",
        city: "Marrakech",
      },
    },
    ...overrides,
  });

  it("publishes a listing that is complete in French alone", async () => {
    const { publishListingAction } = await import("./admin-actions");
    mocks.getListingForEditor.mockResolvedValue(stored());

    const result = await publishListingAction(null, completeForm());

    // English is optional by decision: the site already shows French with an
    // honest note, and holding a finished property off the site until somebody
    // translates it costs the agency more than the note does.
    expect(result).toEqual({ ok: true, id: "p-test", version: 4 });
  });

  it("refuses an incomplete listing and names the missing fields", async () => {
    const { publishListingAction } = await import("./admin-actions");
    mocks.getListingForEditor.mockResolvedValue(
      stored({
        translations: {
          fr: { slug: "villa-essai", title: "", description: "", district: "", city: "Marrakech" },
        },
      }),
    );

    const result = await publishListingAction(null, completeForm());

    // Naming them is the requirement. "Publishing is refused and the missing
    // fields are named" — a bare refusal sends her hunting through a long form.
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect((result as { fields: string[] }).fields).toEqual(
      expect.arrayContaining(["fr.title", "fr.description", "fr.district"]),
    );
    expect(mocks.publishListing).not.toHaveBeenCalled();
  });

  it("judges what is stored, not what is on the form", async () => {
    const { publishListingAction } = await import("./admin-actions");
    // The form carries a complete French group; the saved listing does not.
    mocks.getListingForEditor.mockResolvedValue(
      stored({
        translations: { fr: { slug: "s", title: "t", description: "", district: "d", city: "c" } },
      }),
    );

    const result = await publishListingAction(null, completeForm());

    /*
     * Publishing happens from the listing index, where there is no form at all.
     * Validating a form here would mean the check passes on a screen and the
     * website shows something else.
     */
    expect(result).toMatchObject({ ok: false, error: "invalid" });
  });

  it("refuses to publish over somebody else's save (AC-10)", async () => {
    const { publishListingAction } = await import("./admin-actions");
    mocks.getListingForEditor.mockResolvedValue(stored({ version: 9 }));

    const result = await publishListingAction(null, completeForm({ version: "3" }));

    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(mocks.publishListing).not.toHaveBeenCalled();
  });
});

describe("failures become keys, never sentences", () => {
  it("reports a concurrent edit", async () => {
    const { ConcurrentEditError } = await import("./writes");
    const { saveListingAction } = await import("./admin-actions");
    mocks.saveListing.mockRejectedValue(new ConcurrentEditError());

    expect(await saveListingAction(null, completeForm())).toEqual({ ok: false, error: "conflict" });
  });

  it("reports a taken address, and says which language", async () => {
    const { SlugTakenError } = await import("./writes");
    const { saveListingAction } = await import("./admin-actions");
    mocks.saveListing.mockRejectedValue(new SlugTakenError("en"));

    // The locale is part of the answer: "that address is taken" is unhelpful on
    // a form with one address box per language.
    expect(await saveListingAction(null, completeForm())).toEqual({
      ok: false,
      error: "slugTaken",
      locale: "en",
    });
  });

  it("reports a taken reference", async () => {
    const { ReferenceTakenError } = await import("./writes");
    const { createListingAction } = await import("./admin-actions");
    mocks.createListing.mockRejectedValue(new ReferenceTakenError());

    // A refusal returns; only a success redirects.
    expect(await createListingAction(null, completeForm())).toEqual({
      ok: false,
      error: "referenceTaken",
    });
  });

  it("lands on the listing it just created rather than on an empty form", async () => {
    const { createListingAction } = await import("./admin-actions");

    /*
     * The first version returned `{ ok: true }` and left her on a cleared
     * "Nouveau bien" form saying "Enregistré." — which reads as a failure, and
     * whose obvious response, pressing the button again, makes a second
     * listing. Found by looking at the screenshot, not by a test.
     */
    await expect(createListingAction(null, completeForm())).rejects.toThrow(
      "REDIRECT /admin/listings/new-id",
    );
  });

  it("lets an unrecognised failure reach the error boundary", async () => {
    const { saveListingAction } = await import("./admin-actions");
    mocks.saveListing.mockRejectedValue(new Error("something nobody has thought about"));

    /*
     * Deliberately not folded into a generic key. An error nobody has
     * considered should be visible, not relabelled as a database outage and
     * turned into a message the client cannot act on.
     */
    await expect(saveListingAction(null, completeForm())).rejects.toThrow(
      "nobody has thought about",
    );
  });
});

describe("the public site is told", () => {
  it("revalidates after a write, and not after a refusal", async () => {
    const { saveListingAction } = await import("./admin-actions");

    await saveListingAction(null, completeForm());
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");

    mocks.revalidatePath.mockClear();
    await saveListingAction(null, completeForm({ price: "pas un prix" }));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
