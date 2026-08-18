import type { PropertyMedia } from "../types";

/**
 * Stand-in photography. Real listing photos are Phase 5 (spec, out of scope);
 * until then galleries are built from the design stock already in `public/`.
 *
 * There are thirteen distinct frames and listings need up to fifteen, so a long
 * gallery repeats. That is a fixture limitation, not a modelling one — each
 * entry still gets its own id and alt text, which is what the gallery keys and
 * announces.
 *
 * **The alt text below describes the photograph, not the file name.** It was
 * written the other way round first, and every string was wrong: `card-palm-04`
 * was announced as "the palm grove seen from the terrace" and is a bedroom with
 * an orange bench; `card-sky-11` was "the sky above the Atlas" and is a European
 * apartment block; `grid-pool-dusk` has no pool in it. A sighted visitor sees
 * placeholder photography and understands it as such — a screen-reader user was
 * being read a confident description of a property that does not exist. Checked
 * frame by frame against the actual images.
 *
 * What the pool really holds, for whoever replaces it: six bedrooms, two shots
 * of one glazed light well, two of the same 1930s balconies, and three other
 * exteriors. None of it is Moroccan, and none of it shows a pool, a courtyard,
 * an olive tree or the Atlas. That is why the neighbourhood pages carry no
 * photograph at all — see `districts.ts`.
 */

const STOCK = [
  {
    file: "grid-pool-dusk.jpg",
    width: 900,
    height: 1125,
    fr: "Une façade à balcons plantés, à l’heure dorée",
    en: "A façade of planted balconies at golden hour",
  },
  {
    file: "grid-courtyard.jpg",
    width: 900,
    height: 1264,
    fr: "Le puits de lumière vitré et ses coursives",
    en: "The glazed light well and its walkways",
  },
  {
    file: "grid-living-wide.jpg",
    width: 1200,
    height: 800,
    fr: "Une chambre et son dressing en menuiserie sur mesure",
    en: "A bedroom and its fitted dressing room",
  },
  {
    file: "grid-terrace.jpg",
    width: 900,
    height: 600,
    fr: "Une maison blanche à terrasse plantée, vue à travers les arbres",
    en: "A white house with a planted roof terrace, seen through the trees",
  },
  {
    file: "reveal-interior.jpg",
    width: 1800,
    height: 1198,
    fr: "Une chambre ouverte sur la végétation par une baie toute hauteur",
    en: "A bedroom opening onto greenery through a full-height window",
  },
  {
    file: "grid-stone-detail.jpg",
    width: 900,
    height: 521,
    fr: "Une chambre en noir et blanc, miroir et coiffeuse",
    en: "A bedroom in black and white, with a mirror and dressing table",
  },
  {
    file: "card-courtyard-07.jpg",
    width: 400,
    height: 267,
    fr: "Une chambre aux tons chauds, séparée du dressing par une cloison vitrée",
    en: "A warm-toned bedroom, divided from the dressing room by a glass partition",
  },
  {
    file: "card-garden-02.jpg",
    width: 400,
    height: 267,
    fr: "Des balcons courbes des années trente, en noir et blanc",
    en: "Curved 1930s balconies, in black and white",
  },
  {
    file: "card-palm-04.jpg",
    width: 400,
    height: 266,
    fr: "Une chambre et son dressing ouvert, banquette orange au pied du lit",
    en: "A bedroom with an open dressing area and an orange bench at the foot of the bed",
  },
  {
    file: "card-stone-01.jpg",
    width: 400,
    height: 251,
    fr: "Une façade de brique sombre percée de loggias",
    en: "A dark brick façade set with loggias",
  },
  {
    file: "card-sky-11.jpg",
    width: 400,
    height: 225,
    fr: "Un immeuble résidentiel contemporain et ses abords plantés",
    en: "A contemporary residential block and its planted approach",
  },
  {
    file: "door-left.jpg",
    width: 1200,
    height: 800,
    fr: "Les balcons arrondis d’un immeuble des années trente",
    en: "The rounded balconies of a 1930s building",
  },
  {
    file: "door-right.jpg",
    width: 1200,
    height: 1686,
    fr: "Le puits de lumière vu depuis la coursive du dernier niveau",
    en: "The light well seen from the top-floor walkway",
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
