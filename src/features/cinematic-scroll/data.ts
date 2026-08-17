import type { AboutShot } from "./types";

/**
 * Composition only. Everything in this file is layout or an asset path — the
 * words all arrive through `CinematicCopy`, because the scene is bilingual and
 * this slice cannot reach the i18n slice to translate them itself.
 */

/**
 * The photography band on the about sheet. Frames rise out of reading order, so
 * they read as arriving rather than sweeping across.
 *
 * Placeholder imagery until the real Marrakech shoot lands (plan.md phase 5).
 * The stock file names do not describe what is in the frame — `grid-pool-dusk`
 * is a planted facade and `grid-stone-detail` is a bedroom — so the alt text in
 * the dictionary is written against the picture, not the filename.
 */
export const aboutShots: readonly AboutShot[] = [
  {
    id: "facade",
    image: "/design/stock/grid-pool-dusk.jpg",
    column: 1,
    span: 4,
    height: 1,
    align: "bottom",
    delay: 0,
  },
  {
    id: "walkway",
    image: "/design/stock/grid-courtyard.jpg",
    column: 5,
    span: 2,
    height: 0.62,
    align: "top",
    delay: 0.52,
  },
  {
    id: "bedroom",
    image: "/design/stock/grid-stone-detail.jpg",
    column: 7,
    span: 3,
    height: 0.8,
    align: "bottom",
    delay: 0.18,
  },
  // Not door-right.jpg: that is the same stairwell as `walkway`, and the pair
  // read as a duplicate in the band.
  {
    id: "terraces",
    image: "/design/stock/grid-terrace.jpg",
    column: 10,
    span: 3,
    height: 0.94,
    align: "top",
    delay: 0.34,
  },
];

/** Static scene plates. Paths are public/ assets exported from the design bundle. */
export const scene = {
  sky: "/design/belso-sky-bg.png",
  housePlate: "/design/belso-house-plate.png",
} as const;
