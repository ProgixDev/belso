import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PropertyMedia } from "../types";
import { Gallery } from "./gallery";

/**
 * The gallery's accessible names, and nothing else.
 *
 * **Why this file exists.** A photograph the client never described made
 * `altFor` return `""`, which became `aria-label=""` on its thumbnail button —
 * leaving the control with no accessible name at all rather than a poor one.
 * Fifteen of them on a full gallery, and a WCAG 4.1.2 failure in the feature
 * built to stop exactly this ("a bedroom was announced as the palm grove until
 * somebody looked").
 *
 * It survived every gate. `pnpm verify` has no gallery test; `a11y.spec.ts`
 * drives the previous/next buttons, which are labelled from the dictionary and
 * were always fine. And the e2e suite could not have caught it in any case:
 * **every fixture photograph carries alt text**, deliberately, so the empty
 * branch is unreachable from seeded data. It appears only on listings written
 * through the back-office — the path spec 011 added and no fixture models.
 *
 * That is the lesson worth keeping: a fixture that is always well-formed hides
 * the branch that handles malformed input. These cases construct the media
 * directly for that reason.
 */

const photograph = (id: string, alt: PropertyMedia["alt"]): PropertyMedia => ({
  id,
  url: `/media/${id}/master.webp`,
  width: 2560,
  height: 1707,
  alt,
});

const labels = {
  gallery: "Photographies",
  previous: "Photo précédente",
  next: "Photo suivante",
  photoOf: "Photo {index} sur {total}",
};

describe("Gallery accessible names", () => {
  it("names a thumbnail by its description when there is one", () => {
    render(
      <Gallery
        media={[
          photograph("a", { fr: "La piscine au crépuscule" }),
          photograph("b", { fr: "Le salon" }),
        ]}
        locale="fr"
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: "Le salon" })).toBeInTheDocument();
  });

  it("falls back to the position when a photograph has no description", () => {
    // The listing the client wrote and did not describe. Before the fix this
    // button had `aria-label=""` and therefore no accessible name.
    render(
      <Gallery media={[photograph("a", {}), photograph("b", {})]} locale="fr" labels={labels} />,
    );

    expect(screen.getByRole("button", { name: "Photo 1 sur 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo 2 sur 2" })).toBeInTheDocument();
  });

  it("leaves no thumbnail unnamed when only some are described", () => {
    render(
      <Gallery
        media={[photograph("a", { fr: "La piscine" }), photograph("b", {}), photograph("c", {})]}
        locale="fr"
        labels={labels}
      />,
    );

    /*
     * The assertion that matters, stated over the whole set rather than one
     * control: every button in the gallery has a name. A per-case check would
     * pass while the fourth thumbnail was silent.
     */
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAccessibleName();
    }
  });

  it("uses the French description on the English site when English is missing", () => {
    // The untranslated fallback the site is built on (AC-3), one layer down:
    // an English visitor gets the French description rather than nothing.
    render(<Gallery media={[photograph("a", { fr: "Le patio" })]} locale="en" labels={labels} />);

    expect(screen.getByRole("img", { name: "Le patio" })).toBeInTheDocument();
  });
});
