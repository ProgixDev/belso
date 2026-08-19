"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/core/i18n";
import { CHROME_BAND } from "@/features/cinematic-scroll";
import { type Dictionary, LocaleSwitcher } from "@/features/i18n";
import { cn } from "@/lib/utils";
import { contactAction, headerNav } from "./navigation";

/**
 * The one header, on every page including the home scene.
 *
 * The layout is the scene's original design — logo left, navigation centred,
 * actions right, a hairline rule beneath — because that design was right. What
 * was wrong was where it lived: *inside* the animated world, so it scaled and
 * receded with it (1226px wide at rest, 1122px mid-beat) before being buried
 * under the about sheet. It is now fixed chrome above the scene, so it holds
 * perfectly still while the film plays behind it.
 *
 * Over the scene it carries no background at all — nothing opaque crosses the
 * frame. It stays legible because the scene publishes `--chrome-on-light`
 * (0..1) on the document as its backdrop swings from the dark sky to the cream
 * about sheet; type and rule are mixed between the two ends of that range.
 * Continuous, so there is no threshold to snap at.
 *
 * Past the scene it is an ordinary solid header with no halo, because the page
 * below is flat colour and a halo on flat colour is grime.
 */

/** Type and rule track the scene's backdrop; no fill, so the frame reads through. */
const SCENE_CHROME = {
  "--chrome-ink": "color-mix(in oklab, #f9f2e8, #241c16 calc(var(--chrome-on-light, 0) * 100%))",
  "--chrome-rule":
    "color-mix(in oklab, rgba(249, 242, 232, 0.28), rgba(36, 28, 22, 0.16) calc(var(--chrome-on-light, 0) * 100%))",
  /*
   * A halo in the *opposite* tone to the type, always on.
   *
   * Some frames of the scene are mid-tone — a sunlit sky, a pale facade — where
   * neither white nor near-black clears 4.5:1 on its own. The halo is what
   * carries those: it separates the letterforms from whatever is immediately
   * behind them. It swaps sides with the ink, so it is a dark glow under light
   * type and a light one under dark type, and never a smudge.
   */
  "--chrome-halo":
    "color-mix(in oklab, rgba(14, 10, 7, 0.82), rgba(255, 251, 245, 0.86) calc(var(--chrome-on-light, 0) * 100%))",
  /*
   * The contact button is the one opaque thing allowed to cross the frame.
   *
   * Everything else in the header is type on the film, which is what keeps the
   * scene whole — but a call to action that reads as a link is not a call to
   * action. It fills cream over the dark sky and ink over the cream sheet, and
   * its label takes the other end of the same pair.
   *
   * **It flips rather than fades, and that is the whole point.** Blending both
   * ends of a pair against each other is a trap: the fill travels cream → ink
   * while the label travels ink → cream, so they *cross*, and at the midpoint
   * they are the same colour. Measured across the tint's full range, that is
   * 1.00:1 at t=0.5 and below 4.5:1 for half the transition — a solid pill with
   * no label in it. Stepping the tint at the midpoint keeps both ends locked
   * together at 15.08:1 at every value, and the swap lands inside a transition
   * the eye is already following. It is also what the tint already asks for:
   * `use-cinematic-scroll.ts` says the chrome "should commit quickly and spend
   * as little time as possible in between".
   */
  "--chrome-cta-step": "clamp(0, calc((var(--chrome-on-light, 0) - 0.5) * 1000), 1)",
  "--chrome-cta-fill": "color-mix(in oklab, #f9f2e8, #241c16 calc(var(--chrome-cta-step) * 100%))",
  "--chrome-cta-label": "color-mix(in oklab, #241c16, #f9f2e8 calc(var(--chrome-cta-step) * 100%))",
} as React.CSSProperties;

/**
 * The scene’s own frame, so the chrome is the same object on every page.
 *
 * Over the film the header is inset by `FRAME_MARGIN` (the framed world does
 * not touch the page edge) and padded by `FRAME_PAD` inside that. Off the scene
 * it is a full-width solid bar with no margin, so it takes the *sum* as padding
 * and the wordmark lands on exactly the same vertical as it did over the hero.
 *
 * Before this, the page header was `mx-auto max-w-7xl px-6`: centred in a
 * 1280px column and a little taller. On a 1440px screen that moved the wordmark
 * 26px inwards on leaving the scene; on a 1920px screen, 258px — the whole
 * chrome visibly jumped inboard and grew 8px taller at the same moment.
 */
const FRAME_MARGIN = "clamp(14px, 2.1vw, 32px)";
const FRAME_PAD = "clamp(12px, 3.3vw, 54px)";

/** Off the scene there is nothing to track, so it is an ordinary solid header. */
const PAGE_CHROME = {
  "--chrome-ink": "var(--color-foreground)",
  "--chrome-rule": "var(--color-border)",
  // Off the scene the header sits on a flat surface; a halo would be grime.
  "--chrome-halo": "transparent",
  // The ordinary primary-button pair, which the tokens already guarantee.
  "--chrome-cta-fill": "var(--color-foreground)",
  "--chrome-cta-label": "var(--color-background)",
} as React.CSSProperties;

export function SiteHeader({
  locale,
  dict,
  overlay = false,
}: {
  locale: Locale;
  dict: Dictionary;
  /** Sits over the cinematic scene, tinting itself to it. Landing page only. */
  overlay?: boolean;
}) {
  const [overScene, setOverScene] = useState(true);

  useEffect(() => {
    if (!overlay) return;

    /*
     * Measured against the scene's own box, not a scroll number.
     *
     * `scrollY < MOTION.runway` looked equivalent and was wrong by a full
     * viewport: the sticky stage is still pinned at the end of the runway, so
     * the scene occupies `100vh + runway`. The header spent that last screenful
     * in scene mode over the ordinary page below — no background, and its
     * legibility halo printing grey smudges around the wordmark on cream.
     */
    const onScroll = () => {
      const scene = document.getElementById("scene");
      setOverScene((scene?.getBoundingClientRect().bottom ?? 0) > CHROME_BAND);
    };
    onScroll(); // A reload partway down must not start in scene mode.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [overlay]);

  const onScene = overlay && overScene;
  const nav = headerNav(locale, dict);
  const contact = contactAction(locale, dict);

  return (
    <header
      className={cn(
        "top-0 z-50 transition-colors duration-500 motion-reduce:transition-none",
        // `fixed` on the landing page so the scene keeps the full viewport;
        // `sticky` elsewhere, where reserving the space is correct.
        overlay ? "fixed inset-x-0" : "sticky",
        onScene
          ? // Indented to the scene's own frame, so the rule ends where the
            // framed world ends instead of running into the cream surround.
            "mx-[var(--chrome-margin)] mt-[var(--chrome-margin)]"
          : "bg-background/90 backdrop-blur-md",
      )}
      style={
        {
          ...(onScene ? SCENE_CHROME : PAGE_CHROME),
          "--chrome-margin": FRAME_MARGIN,
          "--chrome-inset": onScene ? FRAME_PAD : `calc(${FRAME_MARGIN} + ${FRAME_PAD})`,
        } as React.CSSProperties
      }
    >
      {/* First tab stop on every page: keyboard users should not wade through the nav (AC-11). */}
      <a
        href="#main"
        className="bg-background text-foreground focus-visible:ring-ring sr-only px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:ring-2"
      >
        {dict.nav.skipToContent}
      </a>

      {/*
       * Below `sm` this wraps to two lines: wordmark and language on the first,
       * the navigation spread across the second.
       *
       * Not a style preference — measured. In one row the four links plus the
       * switcher need about 420px of the 336px a 390px phone has, so "À propos"
       * broke onto two lines (34px tall against its neighbours' 17px) and the
       * FR/EN switcher was pushed to x=447 in a 390px viewport. Clipped, not
       * scrollable: on any phone at or below 414px the language could not be
       * changed at all, which is AC-1 failing silently on the most common
       * screen size we have. Shrinking the type instead saves roughly 56px of
       * the 84px needed and cheapens the chrome to do it.
       */}
      <div
        className={cn(
          "flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b",
          // Same padding either way; only the inset differs, and that is a
          // variable so the two modes cannot drift apart again.
          "px-[var(--chrome-inset)] pt-3 pb-3",
        )}
        style={{ borderColor: "var(--chrome-rule)" }}
      >
        {/*
         * Wordmark and language together on the left.
         *
         * The switcher used to sit beside the contact button, where it read as
         * part of the call to action and was the thing standing between the
         * button and the right edge. Two reasons it moved rather than just
         * gaining a gap:
         *
         * It is a context control, not an action: "this is Belso, in French"
         * belongs beside the name. And it leaves exactly one thing on the
         * right, which is the point of putting a button there at all.
         *
         * **Not a fit decision.** The obvious argument — that `ar`, `it` and
         * `nl` are planned and the switcher lists every locale rather than
         * toggling two, so five of them would crowd the button — does not
         * survive measurement: simulated at five locales, both placements wrap
         * to three rows on a 390px screen and neither clips anything (left
         * 120px tall, right 113px). Recorded so nobody moves it back for a
         * reason the numbers do not support, in either direction.
         */}
        <div className="flex items-baseline gap-[clamp(10px,1.1vw,16px)]">
          <Link
            href={`/${locale}`}
            className="font-[family-name:var(--font-archivo)] text-base leading-none font-bold tracking-[0.06em] text-[var(--chrome-ink)] uppercase [text-shadow:0_1px_1px_var(--chrome-halo),0_0_3px_var(--chrome-halo),0_0_14px_var(--chrome-halo)]"
          >
            Belso
          </Link>

          {/* A hairline, not a slash: the same rule the header is drawn with. */}
          <span
            aria-hidden="true"
            className="h-[13px] w-px self-center"
            style={{ backgroundColor: "var(--chrome-rule)" }}
          />

          <LocaleSwitcher locale={locale} label={dict.locale.label} tone="chrome" />
        </div>

        {/*
         * `order-last` rather than moving it in the DOM: the reading and tab
         * order stays wordmark → navigation → language on every screen, while
         * only the painted order changes.
         */}
        <nav
          aria-label={dict.nav.menu}
          className="order-last flex w-full items-center justify-between gap-[clamp(16px,1.7vw,30px)] sm:order-none sm:w-auto sm:justify-start"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              /*
               * Cormorant, mixed case, barely tracked. Set in caps it loses the
               * ascenders and lowercase that are the whole point of the face —
               * and it needs more size than the sans did to hold its hairlines
               * at this weight.
               */
              className="focus-visible:ring-ring rounded-sm font-serif text-[17px] leading-none font-medium tracking-[0.015em] whitespace-nowrap text-[var(--chrome-ink)] transition-opacity [text-shadow:0_1px_1px_var(--chrome-halo),0_0_3px_var(--chrome-halo),0_0_13px_var(--chrome-halo)] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center">
          {/*
           * Set in the same small caps as every other call to action on the
           * site, and pilled like the hero search rather than squared like the
           * cards — the two things a visitor is asked to *do* look alike.
           *
           * `outline` rather than a ring with an offset: over the scene there
           * is no solid behind the header for an offset to be drawn against,
           * so a ring-offset paints the page background into the film.
           */}
          <Link
            href={contact.href}
            className="rounded-full bg-[var(--chrome-cta-fill)] px-[clamp(13px,1.2vw,19px)] py-[7px] text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap text-[var(--chrome-cta-label)] uppercase transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chrome-ink)] motion-reduce:transition-none"
          >
            {contact.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
