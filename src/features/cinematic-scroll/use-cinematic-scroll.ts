"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./cinematic-scroll.module.css";

/**
 * Motion constants ported verbatim from the Claude Design prototype
 * (`Almera Residences Scroll.dc.html`). Every timing below is expressed in
 * scroll pixels against the reference runway of 6600px; `k` rescales them when
 * `runway` changes, so the whole sequence stays proportional.
 */
export const MOTION = {
  /** Extra scroll length beyond the sticky viewport, in px. */
  runway: 6600,
  /** Scroll lerp factor — lower is heavier. */
  smoothing: 0.14,
  /** Pointer parallax multiplier. */
  parallax: 1,
  /** How far the split panels slide apart, in vw. */
  splitSpread: 46,
  /** Peak backdrop blur, in px. */
  blurAmount: 14,
  /** Splash intro duration, in ms. */
  introDuration: 2600,
  tint: "#c9a882",
  paper: "#f6ece0",
  ink: "#241c16",
} as const;

const REFERENCE_RUNWAY = 6600;

/**
 * Class names toggled imperatively inside the animation loop. `noUncheckedIndexedAccess`
 * types CSS-module lookups as possibly-undefined, and `classList` rejects undefined —
 * the fallbacks are unreachable while the stylesheet defines both rules.
 */
const JUMPING_CLASS = styles.isJumping ?? "isJumping";
const READY_CLASS = styles.isReady ?? "isReady";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, v: number) => {
  const x = clamp((v - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** Eased 0→1 ramp between two normalized stops of the intro timeline. */
const seg = (t: number, a: number, b: number) => easeOut((t - a) / (b - a));

/** enter/exit envelope for a scene that fades in at a→b and out at c→d. */
const segmentInOut = (s: number, a: number, b: number, c: number, d: number) => {
  const enter = smoothstep(a, b, s);
  const exit = smoothstep(c, d, s);
  return { enter, exit, active: enter * (1 - exit) };
};

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
 * Drives the whole cinematic scene.
 *
 * Everything animates through CSS custom properties written onto the section
 * element once per frame — no React re-render is involved in the scroll loop,
 * which is what keeps it smooth. The only piece of React state is the slider
 * index, because that drives an `is-active` class and infinite-loop clones.
 */
export function useCinematicScroll(sightCount: number) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  // Start on the middle copy of the tripled card list so both directions loop.
  const [activeSight, setActiveSight] = useState(sightCount);
  // Mirrored for the transitionend handler, which fires long after render.
  const activeSightRef = useRef(activeSight);
  const isJumpingRef = useRef(false);

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
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;
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
     * the chrome and copy resolve well before it, leaving the CTA as the last beat.
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
      set("--in-note", seg(t, 0.78, 0.92).toFixed(4));
      return seg(t, 0.26, 0.66);
    };

    const getScrollDistance = () =>
      clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);

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

      mouseX = lerp(mouseX, targetMouseX, 0.12);
      mouseY = lerp(mouseY, targetMouseY, 0.12);
      const mX = rm ? 0 : mouseX * MOTION.parallax;
      const mY = rm ? 0 : mouseY * MOTION.parallax;

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

      const s = smoothScroll;
      const aboutIn = smoothstep(640 * k, 1500 * k, s);
      const aboutOut = smoothstep(2100 * k, 2620 * k, s);
      const frame2 = segmentInOut(s, 2600 * k, 3160 * k, 3680 * k, 4020 * k);
      const frame3 = segmentInOut(s, 4220 * k, 4680 * k, 5220 * k, 5460 * k);
      const progress = clamp(s / (5460 * k));
      const introExit = smoothstep(420 * k, 1020 * k, s);
      const sightsEnter = Math.pow(smoothstep(5560 * k, 6280 * k, s), 1.5);
      const sightsControlsEnter = smoothstep(6120 * k, 6420 * k, s);
      const blurActive = clamp(frame2.active + frame3.active);
      const frame2Opacity = frame2.active * (1 - frame3.enter);
      const splitDrift = Math.pow(frame2.enter, 1.5);
      const panel2Opacity = frame2.active * (1 - frame2.exit);
      const panel3Opacity = frame3.active * (1 - frame3.exit);
      const backScale = 0.76 + progress * 0.2 + frame2.enter * 0.18 + frame3.enter * 0.16;
      const sharedHeroY = progress * -74;
      const sharedHeroScale = progress * 0.23;
      const sightsScreenTop = Math.min(220, Math.max(112, window.innerHeight * 0.19)) - 50;
      const sightsParentTop =
        window.innerHeight - (window.innerHeight - sightsScreenTop) / backScale;

      set("--mx", (rm ? 0 : mouseX).toFixed(4));
      set("--my", (rm ? 0 : mouseY).toFixed(4));

      /*
       * The about sheet is an opaque sheet of paper, so it must never be
       * cross-faded over the hero: at any partial opacity the building ghosts
       * through and the whole frame reads as washed out. It reaches full
       * opacity within the first fifth of its travel — while it is still
       * mostly below the fold — and from then on the *slide* does the work.
       * On the way out it holds opaque until the last stretch.
       */
      const aboutCover = Math.min(1, aboutIn * 5);
      const aboutLeave = smoothstep(0.62, 1, aboutOut);
      set("--about-opacity", (aboutCover * (1 - aboutLeave)).toFixed(4));
      /*
       * Drives the collage. It has to track the sheet's *lifetime*, not the
       * raw entrance ramp: `aboutOut` starts long before the sheet fades, so
       * multiplying by it emptied the collage while the paper was still fully
       * covering the hero. Reuses `aboutLeave` so squares and sheet go together.
       */
      set("--about-reveal", (aboutIn * (1 - aboutLeave)).toFixed(4));
      set("--about-y", `${((1 - aboutIn) * 100 - aboutOut * 46).toFixed(2)}%`);

      /*
       * As the sheet rises the hero settles back rather than just shrinking:
       * a deeper scale, a longer lift, and a focus pull. The blur lands on
       * `.world` only, which the sheet is a sibling of, so the copy stays sharp.
       */
      const heroRecede = aboutIn * (1 - aboutOut);
      set("--hero-recede", heroRecede.toFixed(4));
      set("--hero-recede-blur", `${(heroRecede * 7).toFixed(2)}px`);
      set("--hero-recede-dim", (1 - heroRecede * 0.18).toFixed(4));
      set("--back-opacity", (1 - frame2.active * 0.06).toFixed(4));
      set("--back-x", `${(mX * -12).toFixed(2)}px`);
      set("--back-y", `${(mY * -4).toFixed(2)}px`);
      set("--back-scale", backScale.toFixed(4));
      set("--four-y", `${(10 + progress * 10).toFixed(3)}vh`);
      set("--four-scale", (0.78 + progress * 0.16).toFixed(4));
      set("--bazaar-y", `${(20 - progress * 8).toFixed(3)}vh`);
      set("--blur-px", `${(blurActive * MOTION.blurAmount).toFixed(2)}px`);
      set("--back-brightness", (1 - blurActive * 0.255).toFixed(4));
      set("--bazaar-blur-px", `${(frame2.active * MOTION.blurAmount).toFixed(2)}px`);
      set("--bazaar-brightness", (1 - frame2.active * 0.255 - frame3.active * 0.06).toFixed(4));
      set("--bazaar-saturation", (1 + frame3.active * 0.18).toFixed(4));
      set("--shade-opacity", "1");
      set("--shade-z", "2");
      set("--shade-top-alpha", (0.17 + blurActive * 0.3).toFixed(4));
      set("--shade-mid-alpha", (0.05 + blurActive * 0.37).toFixed(4));
      set("--shade-bottom-alpha", (0.28 + blurActive * 0.26).toFixed(4));

      set("--title-y", `${(introExit * -210 + (1 - introTitle) * 30).toFixed(2)}px`);
      set("--title-scale", (1 - introExit * 0.08 - (1 - introTitle) * 0.02).toFixed(4));
      set("--title-opacity", ((1 - introExit) * introTitle).toFixed(4));

      set("--bridge-x", `calc(-50% + 7vw + ${(mX * 18).toFixed(2)}px)`);
      set("--bridge-y", `${(mY * 8 + sharedHeroY - frame2.exit * 760).toFixed(2)}px`);
      set("--bridge-bottom", `${(-4 - frame2.enter * 13).toFixed(3)}vh`);
      set("--bridge-width", `${(79 + frame2.enter * 26).toFixed(3)}vw`);
      set("--bridge-opacity", Math.min(1, frame2.enter * 1.8).toFixed(4));
      set("--plate-opacity", (1 - frame2.enter).toFixed(4));
      set("--bridge-scale", (1.02 + sharedHeroScale + frame2.exit * 0.46).toFixed(4));

      set(
        "--split-left-x",
        `calc(-50% + ${(-splitDrift * MOTION.splitSpread).toFixed(3)}vw + ${(mX * 22).toFixed(2)}px)`,
      );
      set("--split-left-y", `${(mY * 10 + sharedHeroY - splitDrift * 180).toFixed(2)}px`);
      set("--split-left-scale", (1 + sharedHeroScale + frame2.enter * 0.74).toFixed(4));
      set(
        "--split-right-x",
        `calc(-50% + ${(splitDrift * MOTION.splitSpread).toFixed(3)}vw + ${(mX * 22).toFixed(2)}px)`,
      );
      set("--split-right-y", `${(mY * 10 + sharedHeroY - splitDrift * 180).toFixed(2)}px`);
      set("--split-right-scale", (1 + sharedHeroScale + frame2.enter * 0.74).toFixed(4));

      set("--split-opacity", smoothstep(2260 * k, 2620 * k, s).toFixed(4));
      set("--sheet-opacity", smoothstep(4000 * k, 4580 * k, s).toFixed(4));
      set("--frame2-opacity", frame2Opacity.toFixed(4));
      set("--frame2-x", `calc(-50% + ${(mX * 10).toFixed(2)}px)`);
      set("--frame2-y", `calc(-50% + ${(mY * 8 - frame2.exit * 150).toFixed(2)}px)`);
      set("--frame2-scale", (1.06 + frame2.enter * 0.08 + frame2.exit * 0.08).toFixed(4));

      set("--intro-copy-y", `${(introExit * 90).toFixed(2)}px`);
      set("--intro-copy-opacity", (1 - introExit).toFixed(4));
      set("--panel2-opacity", panel2Opacity.toFixed(4));
      set(
        "--panel2-y",
        `calc(-50% + ${(-frame2.exit * 86 + (1 - frame2.enter) * 58).toFixed(2)}px)`,
      );
      set("--panel3-opacity", panel3Opacity.toFixed(4));
      set(
        "--panel3-y",
        `calc(-50% + ${(-frame3.exit * 86 + (1 - frame3.enter) * 58).toFixed(2)}px)`,
      );

      set("--sights-opacity", sightsEnter.toFixed(4));
      set("--sights-controls-opacity", sightsControlsEnter.toFixed(4));
      controlsRef.current?.classList.toggle(READY_CLASS, sightsControlsEnter > 0.98);
      set("--sights-visibility", sightsEnter > 0.01 ? "visible" : "hidden");
      set("--sights-y", "0px");
      set("--sights-enter-x", `${((1 - sightsEnter) * 420).toFixed(3)}vw`);
      set("--sights-scale", (1 / backScale).toFixed(4));
      set("--sights-top", `${sightsParentTop.toFixed(2)}px`);
      set("--sights-screen-top", `${sightsScreenTop.toFixed(2)}px`);

      if (
        introRunning ||
        Math.abs(smoothScroll - targetScroll) > 0.08 ||
        Math.abs(mouseX - targetMouseX) > 0.001 ||
        Math.abs(mouseY - targetMouseY) > 0.001
      ) {
        requestTick();
      }
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
    const onPointer = (e: PointerEvent) => {
      targetMouseX = e.clientX / window.innerWidth - 0.5;
      targetMouseY = e.clientY / window.innerHeight - 0.5;
      requestTick();
    };
    const onVisible = () => requestTick();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    requestTick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisible);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // --- Sights slider -------------------------------------------------------
  // The card list is rendered three times over; we sit on the middle copy and
  // silently jump back a copy once a transition carries us into an edge copy.

  const applyShift = useCallback((index: number) => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const first = track?.firstElementChild;
    if (!section || !track || !(first instanceof HTMLElement)) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    section.style.setProperty(
      "--sights-shift",
      `${(-(first.offsetWidth + gap) * index).toFixed(2)}px`,
    );
  }, []);

  useLayoutEffect(() => {
    activeSightRef.current = activeSight;
    applyShift(activeSight);
    if (!isJumpingRef.current) return;
    isJumpingRef.current = false;
    const track = trackRef.current;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => track?.classList.remove(JUMPING_CLASS));
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSight, applyShift]);

  useEffect(() => {
    const onResize = () => applyShift(activeSight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeSight, applyShift]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !sightCount) return;
    const onTransitionEnd = () => {
      const i = activeSightRef.current;
      const next = i >= sightCount * 2 ? i - sightCount : i < sightCount ? i + sightCount : i;
      if (next === i) return;
      track.classList.add(JUMPING_CLASS);
      isJumpingRef.current = true;
      setActiveSight(next);
    };
    track.addEventListener("transitionend", onTransitionEnd);
    return () => track.removeEventListener("transitionend", onTransitionEnd);
  }, [sightCount]);

  const moveSlider = useCallback((dir: number) => setActiveSight((i) => i + dir), []);
  const selectSight = useCallback((index: number) => setActiveSight(index), []);

  return {
    sectionRef,
    worldRef,
    trackRef,
    controlsRef,
    activeSight,
    moveSlider,
    selectSight,
  };
}
