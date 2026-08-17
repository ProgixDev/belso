import type { AboutFact, AboutShot, CollageTile, SightCard, Stat } from "./types";

/** Headline numbers. Shown in the hero column and repeated on the cream sheet. */
export const stats: readonly Stat[] = [
  { value: "30+", label: ["Private", "residences"] },
  { value: "06", label: ["Residential", "levels"] },
  { value: "24/7", label: ["Secure", "living"] },
] as const;

/** Primary navigation. Each entry maps to a section anchor inside the scroll runway. */
/**
 * Scroll targets for the nav.
 *
 * The scene's "sections" are not laid out down the page — they are visual
 * states of one sticky stage, driven by how far the window has scrolled. Their
 * elements therefore have no meaningful document position: before this, every
 * anchor resolved to the top of the page (or above it — `#bazaar` reported
 * -213px), so clicking the nav did nothing at all.
 *
 * These markers are real elements placed *in the runway* at the scroll offset
 * where each beat is fully on screen, so a plain `href="#id"` lands correctly
 * with no JavaScript and the back button behaves.
 *
 * `at` is a fraction of the runway, not a pixel value, so the beats stay in
 * step if `MOTION.runway` changes — the same rescaling the animation itself
 * uses. Values are the midpoint of each beat's fully-visible window in
 * `use-cinematic-scroll.ts`.
 */
export const sceneAnchors = [
  /** About sheet, "A quieter kind of address" — fully in over 1500–2100 of 6600. */
  { id: "about", at: 0.273 },
  /** Residences, "A slower way to live." — frame 2 holds over 3160–3680. */
  { id: "residences", at: 0.518 },
  /** Amenities, "Everything close, nothing near." — frame 3 holds over 4680–5220. */
  { id: "amenities", at: 0.75 },
] as const;

export const navLinks = [
  { label: "Home", href: "#cinema" },
  { label: "About", href: "#about" },
  { label: "Residences", href: "#residences" },
  { label: "Amenities", href: "#amenities" },
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
    span: 4,
    height: 1,
    align: "bottom",
    delay: 0,
  },
  {
    id: "walkway",
    image: "/design/stock/grid-courtyard.jpg",
    imageAlt: "A sunlit walkway running along the inner courtyard",
    column: 5,
    span: 2,
    height: 0.62,
    align: "top",
    delay: 0.52,
  },
  {
    id: "bedroom",
    image: "/design/stock/grid-stone-detail.jpg",
    imageAlt: "A bedroom in warm neutrals with a woven throw across the bed",
    column: 7,
    span: 3,
    height: 0.8,
    align: "bottom",
    delay: 0.18,
  },
  {
    // Not door-right.jpg: that is the same stairwell as `walkway` above and the
    // pair read as a duplicate in the collage.
    id: "terraces",
    image: "/design/stock/grid-terrace.jpg",
    imageAlt: "Planted terraces above the garden, seen from below",
    column: 10,
    span: 3,
    height: 0.94,
    align: "top",
    delay: 0.34,
  },
];

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
