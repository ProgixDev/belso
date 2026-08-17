"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/core/i18n";
import { CHROME_BAND } from "@/features/cinematic-scroll";
import { type Dictionary, LocaleSwitcher } from "@/features/i18n";
import { cn } from "@/lib/utils";
import { primaryNav } from "./navigation";

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
} as React.CSSProperties;

/** Off the scene there is nothing to track, so it is an ordinary solid header. */
const PAGE_CHROME = {
  "--chrome-ink": "var(--color-foreground)",
  "--chrome-rule": "var(--color-border)",
  // Off the scene the header sits on a flat surface; a halo would be grime.
  "--chrome-halo": "transparent",
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
  const nav = primaryNav(locale, dict);

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
            "mx-[clamp(14px,2.1vw,32px)] mt-[clamp(14px,2.1vw,32px)]"
          : "bg-background/90 backdrop-blur-md",
      )}
      style={onScene ? SCENE_CHROME : PAGE_CHROME}
    >
      {/* First tab stop on every page: keyboard users should not wade through the nav (AC-11). */}
      <a
        href="#main"
        className="bg-background text-foreground focus-visible:ring-ring sr-only px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:ring-2"
      >
        {dict.nav.skipToContent}
      </a>

      <div
        className={cn(
          "flex w-full items-end justify-between gap-6 border-b",
          onScene ? "px-[clamp(12px,3.3vw,54px)] pt-3 pb-3" : "mx-auto max-w-7xl px-6 pt-4 pb-4",
        )}
        style={{ borderColor: "var(--chrome-rule)" }}
      >
        <Link
          href={`/${locale}`}
          className="font-[family-name:var(--font-archivo)] text-base leading-none font-bold tracking-[0.06em] text-[var(--chrome-ink)] uppercase [text-shadow:0_1px_1px_var(--chrome-halo),0_0_3px_var(--chrome-halo),0_0_14px_var(--chrome-halo)]"
        >
          Belso
        </Link>

        <nav aria-label={dict.nav.menu} className="flex items-center gap-[clamp(16px,1.7vw,30px)]">
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
              className="focus-visible:ring-ring rounded-sm font-serif text-[17px] leading-none font-medium tracking-[0.015em] text-[var(--chrome-ink)] transition-opacity [text-shadow:0_1px_1px_var(--chrome-halo),0_0_3px_var(--chrome-halo),0_0_13px_var(--chrome-halo)] hover:opacity-70 focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LocaleSwitcher locale={locale} label={dict.locale.label} tone="chrome" />
      </div>
    </header>
  );
}
