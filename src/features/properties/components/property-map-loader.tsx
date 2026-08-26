"use client";

import dynamic from "next/dynamic";

/**
 * The map, fetched only when a visitor asks for it.
 *
 * This file exists to hold a client boundary in the right place, and it solves
 * two problems that look unrelated and are not.
 *
 * **The barrel cannot carry a client component.** `index.ts` re-exports
 * `repository.ts`, which is `server-only`, so anything importing the barrel into
 * a client bundle fails the build. But the boundary rules forbid `app` from
 * deep-importing a feature's internals, so the page cannot reach past it either.
 * Putting the `"use client"` line here resolves both: the page imports the
 * barrel from a Server Component, and the client boundary starts inside the
 * slice, one file below it.
 *
 * **`ssr: false` is illegal in a Server Component.** Next requires it to be
 * declared from the client, which is the same file this had to be anyway.
 *
 * The skeleton matches the map's own box, so switching views does not shift the
 * page under the visitor while MapLibre is fetched.
 */
export const PropertyMap = dynamic(
  () => import("./property-map").then((module) => module.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="border-border bg-muted h-[62dvh] min-h-[26rem] animate-pulse rounded-2xl border" />
    ),
  },
);
