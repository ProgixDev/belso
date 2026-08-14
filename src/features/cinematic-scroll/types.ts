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

/** A captioned photograph in the about sheet's supporting row. */
export type AboutShot = {
  id: string;
  image: string;
  imageAlt: string;
  caption: string;
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
