"use client";

import { useEffect, useRef } from "react";
import styles from "./cinematic-scroll.module.css";

/**
 * Motion constants ported from the Claude Design prototype
 * (`Almera Residences Scroll.dc.html`). Every timing below is expressed in
 * scroll pixels against the reference runway; `k` rescales them when `runway`
 * changes, so the whole sequence stays proportional.
 *
 * The scene is two beats now — the hero, then the about sheet — where it used
 * to be six across a 6600px runway. The four that followed (split frames, the
 * residences bridge, the amenities panel, a sliding card deck over a collage)
 * each spoke a different motion language and together held the scroll hostage
 * for four thousand pixels. What comes after about is an ordinary page.
 */
export const MOTION = {
  /**
   * Extra scroll length beyond the sticky viewport, in px.
   *
   * Every pixel of it has to move something. The stage is pinned for the whole
   * runway, so scroll that maps to no change is scroll where the page simply
   * does not respond — measured at 2400px, 1300px of it was dead: 400px before
   * the first beat began and 900px after the last one finished.
   */
  runway: 1400,
  /** Scroll lerp factor — lower is heavier. */
  smoothing: 0.14,
  /** Splash intro duration, in ms. */
  introDuration: 2600,
  tint: "#c9a882",
  paper: "#f6ece0",
  ink: "#241c16",
} as const;

/**
 * The runway the timings below were authored against, so `k` is 1 as shipped.
 * Re-baselined whenever the runway changes: the stops are absolute scroll
 * pixels, so leaving a stale reference in place rescales the whole film.
 */
const REFERENCE_RUNWAY = 1400;

/**
 * Toggled imperatively inside the animation loop. `noUncheckedIndexedAccess`
 * types CSS-module lookups as possibly-undefined, and `classList` rejects
 * undefined — the fallback is unreachable while the stylesheet defines the rule.
 */
const REVEALED_CLASS = styles.isRevealed ?? "isRevealed";

/**
 * The band at the top of the viewport the site header occupies, in px.
 *
 * Shared with the header itself: the scene measures what is behind this band to
 * tint its type, and the header measures the scene's bottom edge against it to
 * know when it has left. Two different numbers here means a header that changes
 * appearance a moment before or after the thing it is reacting to.
 */
export const CHROME_BAND = 96;

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, v: number) => {
  const x = clamp((v - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** Eased 0→1 ramp between two normalized stops of the intro timeline. */
const seg = (t: number, a: number, b: number) => easeOut((t - a) / (b - a));

/** "#c9a882" → "201, 168, 130", for use inside rgba(). */
const rgbList = (hex: string) => {
  const raw = hex.trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return "201, 168, 130";
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
};

/**
 * Drives the cinematic scene: the hero, and the about sheet that closes it.
 *
 * Everything animates through CSS custom properties written onto the section
 * element once per frame — no React re-render is involved in the scroll loop,
 * which is what keeps it smooth. There is no React state here at all now that
 * the card slider is gone; the hook is refs and one effect.
 */
export function useCinematicScroll() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const world = worldRef.current;
    if (!section || !world) return;

    const set = (name: string, value: string) => section.style.setProperty(name, value);
    const k = MOTION.runway / REFERENCE_RUNWAY;

    set("--runway", `${MOTION.runway}px`);
    set("--blur-tint", rgbList(MOTION.tint));
    set("--paper", MOTION.paper);
    set("--ink", MOTION.ink);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let targetScroll = 0;
    let smoothScroll = 0;
    let initialized = false;
    let introStart: number | null = null;
    let introRunning = false;

    /**
     * The house plate is a cover-fitted 1977×1954 image. This is how much of it
     * is cropped off vertically, which is exactly how far it can rise during the
     * intro without revealing an edge. Only the plate's aspect ratio matters here,
     * so these two must stay in step with the asset.
     *
     * Cached: reading the rect per frame forces a layout on every intro frame,
     * which is what made the splash stutter. Only the viewport invalidates it.
     */
    const PLATE_W = 1977;
    const PLATE_H = 1954;
    let cachedRiseSlack: number | null = null;
    const riseSlack = () => {
      if (cachedRiseSlack !== null) return cachedRiseSlack;
      const r = world.getBoundingClientRect();
      if (!r.width || !r.height) return 0;
      const scale = Math.max(r.width / PLATE_W, r.height / PLATE_H);
      cachedRiseSlack = Math.max(0, (PLATE_H * scale - r.height) / 2);
      return cachedRiseSlack;
    };

    /**
     * Intro timeline, in normalized 0→1 of `introDuration`. The plate's rise owns
     * the full envelope; the type runs on tighter, more closely spaced windows so
     * the chrome and copy resolve well before it, leaving the search block as the
     * last beat — `--in-cta` reaching 1 is what says the splash has finished, and
     * the e2e specs wait on exactly that.
     */
    const applyIntro = (t: number) => {
      set("--rise", `${((1 - seg(t, 0, 0.86)) * riseSlack()).toFixed(2)}px`);
      set("--in-logo", seg(t, 0.14, 0.27).toFixed(4));
      for (let i = 1; i <= 5; i++) {
        set("--in-n" + i, seg(t, 0.18 + (i - 1) * 0.033, 0.3 + (i - 1) * 0.033).toFixed(4));
      }
      set("--in-contact", seg(t, 0.36, 0.48).toFixed(4));
      for (let i = 1; i <= 3; i++) {
        set("--in-s" + i, seg(t, 0.5 + (i - 1) * 0.038, 0.62 + (i - 1) * 0.038).toFixed(4));
      }
      for (let i = 1; i <= 4; i++) {
        set("--in-l" + i, seg(t, 0.56 + (i - 1) * 0.042, 0.7 + (i - 1) * 0.042).toFixed(4));
      }
      set("--in-cta", seg(t, 0.76, 0.9).toFixed(4));
      return seg(t, 0.26, 0.66);
    };

    const getScrollDistance = () =>
      clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);

    /*
     * How light the backdrop is *behind the header*, 0..1, for the site header
     * to tint its type against.
     *
     * Measured, not inferred. The first version read the light layers' own
     * opacity, which says whether the cream sheets are visible **somewhere** —
     * not whether they are behind the header. They usually are not: the sheets
     * rise from below, so for most of the runway the header band still shows
     * dark photography while the sheet is fully opaque further down. Contrast
     * measured 1.32:1 at its worst, dark type on dark image.
     *
     * So this asks the only question that matters: does a light layer actually
     * cover the band the header occupies, and how opaque is it there.
     *
     * Published on the document because the header is fixed *outside* this
     * subtree, and CSS variables only cascade downwards.
     */
    let lightLayers: HTMLElement[] = [];

    const publishChromeTone = () => {
      if (lightLayers.length === 0) {
        lightLayers = Array.from(
          section.querySelectorAll<HTMLElement>('[data-chrome-tone="light"]'),
        );
      }

      let cover = 0;
      for (const layer of lightLayers) {
        const r = layer.getBoundingClientRect();
        if (r.width === 0 || r.top >= CHROME_BAND || r.bottom <= 0) continue;
        const overlap = (Math.min(CHROME_BAND, r.bottom) - Math.max(0, r.top)) / CHROME_BAND;
        const opacity = Number.parseFloat(getComputedStyle(layer).opacity) || 0;
        cover = Math.max(cover, clamp(overlap) * opacity);
      }

      /*
       * Deliberately steep. Mixing type linearly toward the midpoint produces a
       * mid-grey that fails against *both* ends — measured 1.59:1 mid-crossfade,
       * worse than either extreme. The type should commit quickly and spend as
       * little time as possible in between.
       */
      document.documentElement.style.setProperty(
        "--chrome-on-light",
        smoothstep(0.34, 0.56, cover).toFixed(4),
      );
    };

    const update = () => {
      const rm = reduceMotion.matches;

      targetScroll = getScrollDistance();
      if (!initialized || rm) {
        smoothScroll = targetScroll;
        initialized = true;
      } else {
        smoothScroll = lerp(smoothScroll, targetScroll, MOTION.smoothing);
      }
      if (Math.abs(smoothScroll - targetScroll) < 0.08) smoothScroll = targetScroll;

      // Splash intro: the plate rises from below, then chrome and type stagger in.
      if (introStart === null) introStart = targetScroll > 40 || rm ? -1 : performance.now();
      let introTitle = 1;
      if (introStart > 0) {
        const t = clamp((performance.now() - introStart) / MOTION.introDuration);
        introTitle = applyIntro(t);
        if (t < 1) {
          introRunning = true;
        } else {
          introRunning = false;
          introStart = -1;
        }
      }

      /*
       * The two beats span the runway end to end, deliberately.
       *
       * The hero copy starts leaving on the first pixel of scroll rather than
       * after 420 of it, and the about sheet finishes 100px before the stage
       * releases rather than 900. That last stretch is the only hold left: long
       * enough to read the sheet at rest, short enough not to feel stuck.
       */
      const s = smoothScroll;
      const introExit = smoothstep(0, 520 * k, s);
      const aboutIn = smoothstep(280 * k, 1300 * k, s);

      /*
       * The about sheet is an opaque sheet of paper, so it must never be
       * cross-faded over the hero: at any partial opacity the building ghosts
       * through and the whole frame reads as washed out. It reaches full
       * opacity within the first fifth of its travel — while it is still
       * mostly below the fold — and from then on the *slide* does the work.
       *
       * It has no exit. The sheet is the scene's last frame: it arrives, it
       * holds, and then the sticky stage releases and the page carries it away
       * like any other content. Animating it back off screen only to hand over
       * to a static section below was the scene refusing to end.
       */
      set("--about-opacity", Math.min(1, aboutIn * 5).toFixed(4));
      /*
       * The photography is armed by a class, not scrubbed by scroll. Tying the
       * rise to scroll position means it freezes half-done when you stop and is
       * skipped entirely when you flick past — so it is never actually seen.
       * Crossing the threshold hands it to CSS, which plays it out over real
       * time with a stagger.
       */
      galleryRef.current?.classList.toggle(REVEALED_CLASS, aboutIn > 0.3);
      set("--about-y", `${((1 - aboutIn) * 100).toFixed(2)}%`);

      /*
       * As the sheet rises the hero settles back rather than just shrinking:
       * a deeper scale, a longer lift, and a focus pull. The blur lands on
       * `.world` only, which the sheet is a sibling of, so the copy stays sharp.
       */
      set("--hero-recede", aboutIn.toFixed(4));
      set("--hero-recede-blur", `${(aboutIn * 7).toFixed(2)}px`);
      set("--hero-recede-dim", (1 - aboutIn * 0.18).toFixed(4));

      set("--title-y", `${(introExit * -210 + (1 - introTitle) * 30).toFixed(2)}px`);
      set("--title-scale", (1 - introExit * 0.08 - (1 - introTitle) * 0.02).toFixed(4));
      set("--title-opacity", ((1 - introExit) * introTitle).toFixed(4));

      set("--intro-copy-y", `${(introExit * 90).toFixed(2)}px`);
      set("--intro-copy-opacity", (1 - introExit).toFixed(4));

      publishChromeTone();

      if (introRunning || Math.abs(smoothScroll - targetScroll) > 0.08) requestTick();
    };

    function requestTick() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    }

    const onScroll = () => requestTick();
    const onResize = () => {
      cachedRiseSlack = null;
      requestTick();
    };
    const onVisible = () => requestTick();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisible);
    requestTick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisible);
      if (raf) cancelAnimationFrame(raf);
      // Leaving the scene must not strand the chrome mid-tint on the next page.
      document.documentElement.style.removeProperty("--chrome-on-light");
    };
  }, []);

  return { sectionRef, worldRef, galleryRef };
}
