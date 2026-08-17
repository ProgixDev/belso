import type { PropertyMedia } from "../types";

/**
 * Stand-in photography. Real listing photos are Phase 5 (spec, out of scope);
 * until then galleries are built from the design stock already in `public/`.
 *
 * There are thirteen distinct frames and listings need up to fifteen, so a long
 * gallery repeats. That is a fixture limitation, not a modelling one — each
 * entry still gets its own id and alt text, which is what the gallery keys and
 * announces.
 */

const STOCK = [
  {
    file: "grid-pool-dusk.jpg",
    width: 900,
    height: 1125,
    fr: "La piscine au crépuscule",
    en: "The pool at dusk",
  },
  {
    file: "grid-courtyard.jpg",
    width: 900,
    height: 1264,
    fr: "Le patio intérieur",
    en: "The inner courtyard",
  },
  {
    file: "grid-living-wide.jpg",
    width: 1200,
    height: 800,
    fr: "Le salon ouvert sur le jardin",
    en: "The living room opening onto the garden",
  },
  {
    file: "grid-terrace.jpg",
    width: 900,
    height: 600,
    fr: "La terrasse et ses banquettes",
    en: "The terrace and its seating",
  },
  {
    file: "reveal-interior.jpg",
    width: 1800,
    height: 1198,
    fr: "L’enfilade des pièces de réception",
    en: "The reception rooms in sequence",
  },
  {
    file: "grid-stone-detail.jpg",
    width: 900,
    height: 521,
    fr: "Le détail de la pierre taillée",
    en: "Detail of the cut stone",
  },
  {
    file: "card-courtyard-07.jpg",
    width: 400,
    height: 267,
    fr: "La cour plantée d’oliviers",
    en: "The courtyard planted with olive trees",
  },
  {
    file: "card-garden-02.jpg",
    width: 400,
    height: 267,
    fr: "Le jardin en fin de journée",
    en: "The garden in late afternoon",
  },
  {
    file: "card-palm-04.jpg",
    width: 400,
    height: 266,
    fr: "La palmeraie depuis la terrasse",
    en: "The palm grove seen from the terrace",
  },
  {
    file: "card-stone-01.jpg",
    width: 400,
    height: 251,
    fr: "Le mur de pierre chaude",
    en: "The warm stone wall",
  },
  {
    file: "card-sky-11.jpg",
    width: 400,
    height: 225,
    fr: "Le ciel au-dessus de l’Atlas",
    en: "The sky above the Atlas",
  },
  {
    file: "door-left.jpg",
    width: 1200,
    height: 800,
    fr: "La porte d’entrée en cèdre",
    en: "The cedar front door",
  },
  {
    file: "door-right.jpg",
    width: 1200,
    height: 1686,
    fr: "L’entrée vue de l’intérieur",
    en: "The entrance seen from inside",
  },
] as const;

/**
 * Build a gallery of `count` frames for a listing. `offset` rotates the starting
 * frame so two listings side by side in the grid do not lead with the same
 * photograph — the quality bar reads that as placeholder data, and it is right to.
 */
export function gallery(reference: string, count: number, offset = 0): PropertyMedia[] {
  return Array.from({ length: count }, (_, index) => {
    const frame = STOCK[(index + offset) % STOCK.length];
    if (!frame) throw new Error("stock pool is empty");
    return {
      id: `${reference}-${String(index + 1).padStart(2, "0")}`,
      url: `/design/stock/${frame.file}`,
      width: frame.width,
      height: frame.height,
      alt: { fr: frame.fr, en: frame.en },
    };
  });
}
