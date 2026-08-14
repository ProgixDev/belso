import type { CollageTile, SightCard, Stat } from "./types";

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
  sky: "/design/besto-sky-bg.png",
  housePlate: "/design/besto-house-plate.png",
  heroTall: "/design/besto-hero-tall.png",
  street: "/design/besto-hero.png",
  doorLeft: "/design/stock/door-left.jpg",
  doorRight: "/design/stock/door-right.jpg",
  reveal: "/design/stock/reveal-interior.jpg",
} as const;
