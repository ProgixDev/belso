/** A residence card in the horizontal slider that flies in at the end of the runway. */
export type SightCard = {
  id: string;
  kicker: string;
  title: string;
  blurb: string;
  image: string;
  imageAlt: string;
};

/** One tile in the amenities collage on the cream sheet. */
export type CollageTile = {
  id: string;
  image: string;
  imageAlt: string;
  /** Inline grid/aspect overrides that give the collage its staggered rhythm. */
  aspectRatio: string;
  marginTop?: string;
  span?: number;
};

/**
 * A photograph in the about sheet's composition.
 *
 * Placement is data rather than CSS so it can be retuned without touching the
 * stylesheet. Sizes are *fractions of the band*, not aspect ratios: the earlier
 * version used square tiles nudged by a free-form margin, which let the tallest
 * one run past the bottom of the sheet and made the whole row read as ragged
 * rather than composed.
 */
export type AboutShot = {
  id: string;
  image: string;
  imageAlt: string;
  /** 1-based start column on the 12-column grid. */
  column: number;
  /** How many of the 12 columns it occupies. */
  span: number;
  /** Height as a fraction of the band, 0–1. Varying these is what gives rhythm. */
  height: number;
  /** Which edge of the band it hangs from — alternating is what stops it looking like a filmstrip. */
  align: "top" | "bottom";
  /**
   * Position in the reveal sequence, 0–1. Deliberately out of reading order so
   * the frames appear to arrive rather than sweeping left to right.
   */
  delay: number;
};

/** A short credential shown along the foot of the about sheet. */
export type AboutFact = {
  value: string;
  label: string;
};

/** A headline number rendered both in the hero column and on the cream sheet. */
export type Stat = {
  value: string;
  /** Two lines, rendered with a hard break between them. */
  label: readonly [string, string];
};

/**
 * The hero search field (AC-2). Strings and the destination are passed in from
 * `app` rather than read here: this slice may not import the i18n slice
 * (docs/architecture/module-boundaries.md), and the listings path is a
 * translated segment only `core/i18n` can build.
 */
export type HeroSearch = {
  /** Where the form submits — already locale- and segment-translated. */
  action: string;
  label: string;
  placeholder: string;
  submitLabel: string;
};
