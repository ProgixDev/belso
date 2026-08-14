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
 * A square photograph in the about sheet's scattered collage.
 * Placement is data rather than CSS so the scatter can be retuned without
 * touching the stylesheet.
 */
export type AboutShot = {
  id: string;
  image: string;
  imageAlt: string;
  /** 1-based start column on the 12-column collage grid. */
  column: number;
  /** How many of the 12 columns the square occupies. */
  span: number;
  /** Vertical nudge, in % of the square's own width. Creates the scatter. */
  offset: number;
  /**
   * Position in the reveal sequence, 0–1. Deliberately out of reading order so
   * the squares appear to arrive at random rather than sweeping left to right.
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
