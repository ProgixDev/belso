import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The editor form (AC-3b).
 *
 * The assertion this file exists for is the last one: **an English group left
 * untouched must reach the action as five empty strings**, so the action can
 * turn that into "no row" rather than a translation whose title is `""`. The
 * difference is invisible in the editor and decisive on the public site — an
 * empty row means the English page shows a blank heading with no explanation,
 * while a missing row means it shows the French text with the honest
 * untranslated note.
 *
 * The action's half of that decision is tested in `admin-actions.test.ts`. This
 * tests the half that has to be true for it to work at all: that the form
 * submits the fields, empty, rather than omitting them or pre-filling them.
 */

const mocks = vi.hoisted(() => ({
  submitted: [] as FormData[],
}));

/**
 * `useActionState` is stubbed rather than the action mocked.
 *
 * jsdom has no Server Action transport, so a real `<form action={serverAction}>`
 * submits nowhere. Replacing the hook keeps the component — the field names,
 * the defaults, the grouping — entirely real, which is the part under test, and
 * captures exactly what a submit would have sent.
 */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [
      null,
      (formData: FormData) => {
        mocks.submitted.push(formData);
      },
      false,
    ],
  };
});

vi.mock("../admin-actions", () => ({
  createListingAction: vi.fn(),
  saveListingAction: vi.fn(),
}));

const listing = {
  id: "p-01",
  version: 7,
  publication: "draft" as const,
  reference: "BL-1101",
  districtId: "palmeraie" as const,
  kind: "sale" as const,
  type: "villa" as const,
  status: "available" as const,
  price: 4250000,
  currency: "MAD" as const,
  bedrooms: 4,
  bathrooms: 3,
  builtArea: 320,
  landArea: undefined,
  builtYear: undefined,
  parking: 2,
  coordinates: undefined,
  amenities: ["pool" as const],
  media: [],
  listedAt: "2026-08-01",
  translations: {
    fr: {
      slug: "villa-vue-atlas",
      title: "Villa vue Atlas",
      description: "Une description française déjà écrite.",
      district: "Palmeraie",
      city: "Marrakech",
    },
  },
};

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: /Enregistrer|Créer/ }));
  const form = mocks.submitted.at(-1);
  if (!form) throw new Error("the form never submitted");
  return form;
}

beforeEach(() => {
  mocks.submitted.length = 0;
});

describe("PropertyEditor", () => {
  it("shows a group per language, and marks which one is required", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    expect(screen.getByText("Français — obligatoire")).toBeInTheDocument();
    expect(screen.getByText("English — optionnel")).toBeInTheDocument();
  });

  it("carries the version it was loaded at, so a save can be refused (AC-10)", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    const form = await submit();
    expect(form.get("version")).toBe("7");
    expect(form.get("id")).toBe("p-01");
  });

  it("sends an untouched English group as empty, not as text (AC-3b)", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    const form = await submit();

    /*
     * Every English field present and empty. Present, because the action reads
     * them to decide the group is empty; empty, because anything pre-filled
     * here — a copy of the French, a placeholder — would be written to the
     * database as a translation that nobody wrote.
     */
    for (const field of ["title", "description", "district", "city", "slug"]) {
      expect(form.get(`en.${field}`), `en.${field}`).toBe("");
    }

    // And the French is untouched by all of this.
    expect(form.get("fr.title")).toBe("Villa vue Atlas");
  });

  it("sends the English group when she fills it in", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    await userEvent.type(screen.getByLabelText("Titre", { selector: "#en-title" }), "Atlas view");
    const form = await submit();

    expect(form.get("en.title")).toBe("Atlas view");
  });

  it("leaves an unknown number empty rather than printing a zero", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    const form = await submit();

    /*
     * `0` would be a lie that survives to the public page as "0 m²", and worse,
     * it teaches her that the boxes are already filled in correctly.
     */
    expect(form.get("landArea")).toBe("");
    expect(form.get("builtYear")).toBe("");
    expect(form.get("builtArea")).toBe("320");
  });

  it("sends a new listing with no id and no version", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor />);

    /*
     * Filled first because the browser refuses to submit until they are: the
     * required boxes start empty on a new listing rather than pre-filled with
     * zeros, so that "0 m²" is something she typed rather than something the
     * form left behind. The date is the only one with a default, and today is a
     * safe guess for when a listing is being created.
     */
    await userEvent.type(screen.getByLabelText("Référence"), "BL-9001");
    await userEvent.type(screen.getByLabelText("Prix"), "4250000");
    for (const box of ["Chambres", "Salles de bain", "Stationnements", "Surface habitable (m²)"]) {
      await userEvent.type(screen.getByLabelText(box), "0");
    }
    await userEvent.type(screen.getByLabelText("Titre", { selector: "#fr-title" }), "Villa");

    const form = await submit();

    // Creation is a different action with a different shape; sending a version
    // for a listing that does not exist yet would be meaningless.
    expect(form.get("id")).toBeNull();
    expect(form.get("version")).toBeNull();
  });

  it("offers neighbourhoods by their French name, not their id", async () => {
    const { PropertyEditor } = await import("./property-editor");
    render(<PropertyEditor listing={listing} />);

    // She knows Guéliz; `gueliz` is an implementation detail of ours.
    expect(screen.getByRole("option", { name: "Guéliz" })).toHaveValue("gueliz");
  });
});
