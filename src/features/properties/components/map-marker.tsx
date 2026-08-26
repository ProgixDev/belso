"use client";

// v6 ships named exports only — there is no default to import.
import * as maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { Coordinates } from "../types";

/**
 * Markers are HTML, and every one of them is a `<button>`.
 *
 * A GL layer would draw faster and could not be focused, named, or read aloud —
 * a canvas has no children. Twenty buttons the map happens to position is the
 * whole keyboard and screen-reader story, and it costs nothing at this scale:
 * clustering keeps the number of *unclustered* markers small at any zoom, which
 * is the point of clustering.
 *
 * It also survives `setStyle`. Swapping to satellite discards the style's own
 * sources and layers; DOM markers the map merely positions are untouched.
 */

/**
 * Hands a React subtree to MapLibre to position.
 *
 * The element is created once and given to `Marker`; React renders into it
 * through a portal. So MapLibre owns *where*, React owns *what*, and neither
 * re-renders the other while the map is being panned.
 */
export function MarkerPortal({
  map,
  at,
  children,
}: {
  map: maplibregl.Map;
  at: Coordinates;
  children: React.ReactNode;
}) {
  const [element] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    // Without this the marker's own box swallows drags meant for the map.
    node.style.cursor = "pointer";
    return node;
  });

  useEffect(() => {
    if (!element) return;
    const marker = new maplibregl.Marker({ element }).setLngLat([at.lng, at.lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, element, at.lat, at.lng]);

  return element ? createPortal(children, element) : null;
}

/** One property. A dot until asked for prices, then the asking price itself. */
export function PropertyPin({
  price,
  label,
  showPrice,
  selected,
  onSelect,
}: {
  /** Already formatted and shortened by the caller — this only draws it. */
  price: string;
  /** What a screen reader hears: the property, not "marker". */
  label: string;
  showPrice: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "focus-visible:ring-ring rounded-full border font-semibold whitespace-nowrap shadow-sm transition-colors",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        selected
          ? "bg-foreground text-background border-transparent"
          : "bg-card text-foreground border-border/60 hover:border-foreground/40",
        showPrice ? "px-2.5 py-1 text-[11px]" : "h-3.5 w-3.5 p-0",
      )}
    >
      {/* The dot carries no text, but the button still has to be named. */}
      <span className={showPrice ? undefined : "sr-only"}>{showPrice ? price : label}</span>
    </button>
  );
}

/** Several properties too close together to separate at this zoom. */
export function ClusterPin({
  count,
  label,
  onSelect,
}: {
  count: number;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      className={cn(
        "bg-foreground text-background focus-visible:ring-ring grid place-items-center rounded-full",
        "text-[11px] font-semibold shadow-md transition-transform",
        "hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "motion-reduce:transition-none motion-reduce:hover:scale-100",
        // Bigger where there is more, but bounded: past a point the number is
        // the information and the circle is just a circle.
        count > 8 ? "h-11 w-11" : count > 3 ? "h-9 w-9" : "h-8 w-8",
      )}
    >
      <span aria-hidden="true">{count}</span>
    </button>
  );
}
