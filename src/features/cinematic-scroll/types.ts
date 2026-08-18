/** The four photographs in the about sheet's composition, by id. */
export type AboutShotId = "facade" | "walkway" | "bedroom" | "terraces";

/**
 * A photograph in the about sheet's composition.
 *
 * Placement is data rather than CSS so it can be retuned without touching the
 * stylesheet. Sizes are *fractions of the band*, not aspect ratios: the earlier
 * version used square tiles nudged by a free-form margin, which let the tallest
 * one run past the bottom of the sheet and made the whole row read as ragged
 * rather than composed.
 *
 * Alt text is not here — it is language, so it comes in through `copy`.
 */
export type AboutShot = {
  id: AboutShotId;
  image: string;
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

/** A value-and-label pair: the hero's headline numbers and the about sheet's credentials. */
export type Figure = {
  value: string;
  label: string;
};

/**
 * Everything the scene says, passed in from `app`.
 *
 * The scene used to hold its own English copy, so `/fr` played French search
 * chrome inside an English film. This slice may not import the i18n slice
 * (docs/architecture/module-boundaries.md), so the route reads the dictionary
 * and hands the words down.
 *
 * The tuples are load-bearing: the splash timeline staggers exactly three stats
 * (`--in-s1..3`) and four lede lines (`--in-l1..4`), so a dictionary that
 * offered a different number would animate some of them and not others. The
 * types make that a build error rather than a missing fade.
 */
export type CinematicCopy = {
  sceneLabel: string;
  heroLabel: string;
  stats: readonly [Figure, Figure, Figure];
  lede: readonly [string, string, string, string];
  scrollHint: string;
  about: {
    name: string;
    place: string;
    statement: string;
    lede: string;
    body: string;
    facts: readonly [Figure, Figure, Figure];
    shots: Record<AboutShotId, string>;
  };
};

/**
 * The hero search field (AC-2). The destination is passed in from `app` for the
 * same reason as the copy: the listings path is a translated segment only
 * `core/i18n` can build.
 */
export type HeroSearch = {
  /** Where the form submits — already locale- and segment-translated. */
  action: string;
  /** Shown above the field, not hidden: this is the site's primary action. */
  label: string;
  placeholder: string;
  submitLabel: string;
  /** One line under the field saying it reads a sentence, not keywords. */
  hint: string;
};
