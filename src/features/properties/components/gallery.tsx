"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/core/i18n";
import { cn } from "@/lib/utils";
import type { PropertyMedia } from "../types";

/**
 * The photography, browsable (AC-5).
 *
 * Which frame is showing is local component state, not a store — nothing else
 * on the page cares, and putting it in the URL would make the back button walk
 * through photographs.
 *
 * Motion is limited to a CSS transition that `motion-reduce` switches off
 * (AC-11); there is no scripted animation to disable.
 */
export function Gallery({
  media,
  locale,
  labels,
}: {
  media: PropertyMedia[];
  locale: Locale;
  labels: { gallery: string; previous: string; next: string; photoOf: string };
}) {
  const [index, setIndex] = useState(0);
  const total = media.length;
  const current = media[index];

  if (!current) return null;

  // Wraps in both directions: reaching the end of a gallery and finding the
  // button dead is a worse experience than looping.
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const position = labels.photoOf
    .replace("{index}", String(index + 1))
    .replace("{total}", String(total));

  return (
    <section aria-label={labels.gallery} className="flex flex-col gap-3">
      <div className="bg-muted relative aspect-[3/2] w-full overflow-hidden rounded-xl">
        <Image
          key={current.id}
          src={current.url}
          alt={current.alt[locale]}
          fill
          priority
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="object-cover"
        />

        {total > 1 ? (
          <>
            <div className="absolute inset-y-0 left-0 flex items-center p-3">
              <Button
                variant="secondary"
                size="icon"
                aria-label={labels.previous}
                onClick={() => go(-1)}
                className="rounded-full opacity-90"
              >
                <span aria-hidden="true">‹</span>
              </Button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center p-3">
              <Button
                variant="secondary"
                size="icon"
                aria-label={labels.next}
                onClick={() => go(1)}
                className="rounded-full opacity-90"
              >
                <span aria-hidden="true">›</span>
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/*
       * Announced politely so a screen-reader user hears the photo change
       * instead of silently losing their place; the count is also the only
       * non-visual cue that there is more than one frame.
       */}
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {position}
      </p>

      {total > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {media.map((frame, i) => (
            <li key={frame.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={frame.alt[locale]}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring relative h-14 w-20 overflow-hidden rounded-md transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none",
                  i === index ? "ring-foreground ring-2" : "opacity-60 hover:opacity-100",
                )}
              >
                <Image src={frame.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
