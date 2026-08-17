import type { AboutFact, AboutShot, CollageTile, SightCard, Stat } from "./types";

/** Headline numbers. Shown in the hero column and repeated on the cream sheet. */
export const stats: readonly Stat[] = [
  { value: "30+", label: ["Private", "residences"] },
  { value: "06", label: ["Residential", "levels"] },
  { value: "24/7", label: ["Secure", "living"] },
] as const;

/** Primary navigation. Each entry maps to a section anchor inside the scroll runway. */
export const navLinks = [
  { label: "Home", href: "#cinema" },
  { label: "About", href: "#bridge" },
  { label: "Projects", href: "#bridge" },
  { label: "Amenities", href: "#bazaar" },
  { label: "Location", href: "#routes" },
] as const;

/** The four words of the hero lede, staggered in one line at a time. */
export const heroLede = ["Where", "heritage", "meets", "home"] as const;

/**
 * The scattered square collage on the about sheet. Squares rise from below,
 * out of reading order, so they read as arriving rather than sweeping across.
 *
 * Alt text describes what is actually in each frame — the stock file names do
 * not. `grid-pool-dusk` is a planted facade, `grid-stone-detail` is a bedroom,
 * and `door-right` is a skylit stairwell. Placeholder imagery until the real
 * Marrakech shoot lands (plan.md phase 5).
 */
export const aboutShots: readonly AboutShot[] = [
  {
    id: "facade",
    image: "/design/stock/grid-pool-dusk.jpg",
    imageAlt: "Planted balconies stepping down a timber-clad facade at golden hour",
    column: 1,
    span: 3,
    offset: -6,
    delay: 0,
  },
  {
    id: "walkway",
    image: "/design/stock/grid-courtyard.jpg",
    imageAlt: "A sunlit walkway running along the inner courtyard",
    column: 4,
    span: 2,
    offset: 34,
    delay: 0.52,
  },
  {
    id: "bedroom",
    image: "/design/stock/grid-stone-detail.jpg",
    imageAlt: "A bedroom in warm neutrals with a woven throw across the bed",
    column: 6,
    span: 2,
    offset: 10,
    delay: 0.18,
  },
  {
    // Not door-right.jpg: that is the same stairwell as `walkway` above and the
    // pair read as a duplicate in the collage.
    id: "terraces",
    image: "/design/stock/grid-terrace.jpg",
    imageAlt: "A pale facade with planted terraces and timber shutters",
    column: 8,
    span: 2,
    offset: 44,
    delay: 0.78,
  },
  {
    id: "joinery",
    image: "/design/stock/grid-living-wide.jpg",
    imageAlt: "Lit oak joinery and marble beside a bedroom doorway",
    column: 10,
    span: 3,
    offset: 18,
    delay: 0.34,
  },
] as const;

/** Credentials along the foot of the about sheet. */
export const aboutFacts: readonly AboutFact[] = [
  { value: "2027", label: "Completion" },
  { value: "1.4 ha", label: "Grounds" },
  { value: "Marrakech", label: "Palmeraie" },
] as const;

export const sights: readonly SightCard[] = [
  {
    id: "garden-02",
    kicker: "Two bedroom",
    title: "Garden Residence 02",
    blurb: "184 sqm with a shaded terrace opening onto the courtyard.",
    image: "/design/stock/card-garden-02.jpg",
    imageAlt: "Plan",
  },
  {
    id: "courtyard-07",
    kicker: "Three bedroom",
    title: "Courtyard Residence 07",
    blurb: "246 sqm, dual aspect, with a private plunge pool.",
    image: "/design/stock/card-courtyard-07.jpg",
    imageAlt: "Plan",
  },
  {
    id: "sky-11",
    kicker: "Penthouse",
    title: "Sky Residence 11",
    blurb: "410 sqm across the top level, with a roof garden.",
    image: "/design/stock/card-sky-11.jpg",
    imageAlt: "Plan",
  },
  {
    id: "palm-04",
    kicker: "Four bedroom",
    title: "Palm Residence 04",
    blurb: "312 sqm facing the palm grove and the water steps.",
    image: "/design/stock/card-palm-04.jpg",
    imageAlt: "Plan",
  },
  {
    id: "stone-01",
    kicker: "Villa",
    title: "Stone Villa 01",
    blurb: "480 sqm, walled garden, private entrance from the lane.",
    image: "/design/stock/card-stone-01.jpg",
    imageAlt: "Plan",
  },
] as const;

export const collage: readonly CollageTile[] = [
  {
    id: "terrace",
    image: "/design/stock/grid-terrace.jpg",
    imageAlt: "Terrace",
    aspectRatio: "3/4",
  },
  {
    id: "courtyard",
    image: "/design/stock/grid-courtyard.jpg",
    imageAlt: "Courtyard",
    aspectRatio: "3/4",
    marginTop: "58px",
  },
  {
    id: "stone-detail",
    image: "/design/stock/grid-stone-detail.jpg",
    imageAlt: "Stone detail",
    aspectRatio: "4/5",
    marginTop: "14px",
  },
  {
    id: "pool-dusk",
    image: "/design/stock/grid-pool-dusk.jpg",
    imageAlt: "Pool at dusk",
    aspectRatio: "3/4",
    marginTop: "96px",
  },
  {
    id: "living-wide",
    image: "/design/stock/grid-living-wide.jpg",
    imageAlt: "Living room — wide",
    aspectRatio: "16/11",
    span: 2,
  },
] as const;

/** Static scene plates. Paths are public/ assets exported from the design bundle. */
export const scene = {
  sky: "/design/belso-sky-bg.png",
  housePlate: "/design/belso-house-plate.png",
  heroTall: "/design/belso-hero-tall.png",
  street: "/design/belso-hero.png",
  doorLeft: "/design/stock/door-left.jpg",
  doorRight: "/design/stock/door-right.jpg",
  reveal: "/design/stock/reveal-interior.jpg",
} as const;
