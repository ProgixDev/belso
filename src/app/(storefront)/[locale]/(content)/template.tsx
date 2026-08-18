"use client";

import { m } from "@/components/motion";

/**
 * A short fade between content pages.
 *
 * `template.tsx` rather than `layout.tsx` because a template re-mounts on every
 * navigation, which is exactly the hook a transition needs — a layout persists
 * and would animate once, on first load, and never again.
 *
 * Opacity only, and brief. A page that slides or scales on arrival fights the
 * browser's scroll restoration and makes a back-navigation feel like a new
 * page rather than a return to one. This is here to take the hard cut off the
 * edge of a navigation, nothing more.
 *
 * The landing page is deliberately outside this group: it opens on the scene's
 * own splash, and two entrances stacked on each other read as a stutter.
 */
export default function ContentTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      // Same guard as the reveals: this start state is server-rendered, so
      // without it a visitor with JavaScript off gets a blank page rather than
      // an unanimated one. Found by loading the site with JS disabled — the
      // reveals were guarded and this wrapper, added later, was not.
      data-reveal=""
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
