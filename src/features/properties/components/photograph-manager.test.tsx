import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The gallery's controls (AC-6).
 *
 * Written after the end-to-end run could not tell whether the reorder buttons
 * were failing or the browser test was: at this altitude the question "does
 * this click reach the action, and with what?" is answered in milliseconds and
 * without a server, which is exactly the question that was expensive to ask
 * through Playwright.
 */

const mocks = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ ok: true as const, id: "p-1", version: 8 })),
  reorder: vi.fn(async () => ({ ok: true as const, id: "p-1", version: 8 })),
  remove: vi.fn(async () => ({ ok: true as const, id: "p-1", version: 8 })),
  alt: vi.fn(async () => ({ ok: true as const, id: "p-1", version: 8 })),
}));

vi.mock("../admin-actions", () => ({
  uploadPhotographAction: mocks.upload,
  reorderPhotographsAction: mocks.reorder,
  removePhotographAction: mocks.remove,
  saveAltTextAction: mocks.alt,
}));

const listing = {
  id: "p-1",
  version: 7,
  publication: "draft" as const,
  reference: "BL-1",
  districtId: "palmeraie" as const,
  kind: "sale" as const,
  type: "villa" as const,
  status: "available" as const,
  price: 1,
  currency: "MAD" as const,
  bedrooms: 1,
  bathrooms: 1,
  builtArea: 1,
  landArea: undefined,
  builtYear: undefined,
  parking: 0,
  coordinates: undefined,
  amenities: [],
  listedAt: "2026-08-01",
  translations: {},
  media: [
    { id: "m-1", url: "/media/a/master.webp", width: 2560, height: 1707, alt: { fr: "Un" } },
    { id: "m-2", url: "/media/b/master.webp", width: 2560, height: 1707, alt: {} },
    { id: "m-3", url: "/media/c/master.webp", width: 2560, height: 1707, alt: {} },
  ],
};

const orderSent = () => {
  const [, data] = mocks.reorder.mock.calls[0] as unknown as [unknown, FormData];
  return data.getAll("order");
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockClear();
});

describe("PhotographManager", () => {
  it("sends the whole gallery in its new order when one moves down", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 1" }));

    /*
     * The whole list, not just the pair. The action writes positions from the
     * array it is given, inside one transaction with the unique constraint
     * deferred — sending a partial order would leave the rest where they were
     * and collide.
     */
    expect(orderSent()).toEqual(["m-2", "m-1", "m-3"]);
  });

  it("sends the new order when one moves up", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Monter la photographie 3" }));

    expect(orderSent()).toEqual(["m-1", "m-3", "m-2"]);
  });

  it("carries the listing's version, so a stale gallery is refused (AC-10)", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 1" }));

    const [, data] = mocks.reorder.mock.calls[0] as unknown as [unknown, FormData];
    expect(data.get("version")).toBe("7");
    expect(data.get("id")).toBe("p-1");
  });

  it("uses the version the previous action returned, not the one it rendered with", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 2" }));

    /*
     * The defect this pins. Every one of these actions moves the listing's
     * version, so the second request has to carry what the first returned.
     * Held in state instead of a ref, both requests send the version the
     * component rendered with — the first succeeds, the second is refused as a
     * concurrent edit, and she is told somebody else changed the listing while
     * the somebody else is her own previous click.
     */
    const [, second] = mocks.reorder.mock.calls[1] as unknown as [unknown, FormData];
    expect(second.get("version")).toBe("8");
  });

  it("cannot move the first photograph up or the last one down", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    expect(screen.getByRole("button", { name: "Monter la photographie 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descendre la photographie 3" })).toBeDisabled();
  });

  it("saves a caption when she leaves the field, naming the language", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    const caption = screen.getAllByLabelText("Description (français)")[1] as HTMLInputElement;
    await userEvent.type(caption, "La piscine au crépuscule");
    await userEvent.tab();

    const [, data] = mocks.alt.mock.calls[0] as unknown as [unknown, FormData];
    expect(data.get("mediaId")).toBe("m-2");
    expect(data.get("locale")).toBe("fr");
    expect(data.get("alt")).toBe("La piscine au crépuscule");
  });

  it("says a caption was saved, rather than saving it silently", async () => {
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 1" }));

    // Captions save on blur, which is the right moment and an invisible one:
    // without a signal she has no way to know it was kept.
    expect(await screen.findByText("Enregistré.")).toBeInTheDocument();
  });

  it("reports a refusal instead of failing silently", async () => {
    mocks.reorder.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
    } as unknown as { ok: true; id: string; version: number });
    const { PhotographManager } = await import("./photograph-manager");
    render(<PhotographManager listing={listing} />);

    await userEvent.click(screen.getByRole("button", { name: "Descendre la photographie 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/modifié entre-temps/);
  });
});
