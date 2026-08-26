"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Locale } from "@/core/i18n";
import { formatCompactPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import { ClusterPin, MarkerPortal, PropertyPin } from "./map-marker";
import { PropertyCard, type PropertyCardLabels } from "./property-card";
import { CITY_ZOOM, MARRAKECH, usePropertyMap } from "./use-property-map";
import type { Coordinates, LocalizedProperty } from "../types";

/**
 * The catalogue as a map (spec 009).
 *
 * Three things about this are deliberate and cost something, so they are worth
 * stating rather than discovering later.
 *
 * **Markers are HTML, not a GL layer.** A canvas cannot be focused or read
 * aloud, and `setStyle` — which is what the satellite switch does — discards
 * the style's sources and layers while leaving DOM markers alone. Both problems
 * disappear at once.
 *
 * **Clustering is done here, in pixels, not by the tile source.** At this scale
 * it is a dozen lines and it keeps every marker a real button. Past a few
 * hundred listings this becomes the wrong trade and the source should cluster
 * instead — at which point the markers have to be re-attached after every style
 * change, which is the cost being deferred.
 *
 * **The card sits in a corner rather than over its pin.** The reference floats
 * it beside the marker; a corner panel is always fully on screen, never
 * collides, and works on a phone without moving the map.
 */

export type MapLabels = {
  /** Names the map region for anything navigating by landmark. */
  region: string;
  modeDefault: string;
  modePrices: string;
  modeSatellite: string;
  showList: string;
  zoomIn: string;
  zoomOut: string;
  recenter: string;
  /** Carries `{count}`. */
  clusterLabel: string;
  approximate: string;
  close: string;
  loading: string;
  failedTitle: string;
  failedBody: string;
};

type Mode = "default" | "prices" | "satellite";

/** How close two pins may be, in pixels, before they become one. */
const CLUSTER_RADIUS = 56;

type Group = { key: string; at: Coordinates; items: LocalizedProperty[] };

export function PropertyMap({
  properties,
  locale,
  labels,
  cardLabels,
  typeLabels,
  listHref,
  styles,
}: {
  properties: LocalizedProperty[];
  locale: Locale;
  labels: MapLabels;
  cardLabels: Omit<PropertyCardLabels, "type">;
  /** Per-property type names, resolved by `app` — the slice cannot read the dictionary. */
  typeLabels: Record<string, string>;
  listHref: string;
  styles: { map: string; satellite?: string };
}) {
  const [mode, setMode] = useState<Mode>("default");
  const [selected, setSelected] = useState<string | null>(null);
  /*
   * Bumped on every settled move. The groups are *derived* below rather than
   * stored, because storing them meant subscribing to `idle` from an effect
   * that only runs once the map is loaded — by which time the map has already
   * gone idle, so the listener waited for a second one that never came and the
   * map rendered with no pins on it.
   */
  const [moves, setMoves] = useState(0);

  // Read once, imperatively — the same approach `use-cinematic-scroll.ts` takes,
  // and it avoids a hook that re-renders the whole map on a system setting.
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const styleUrl = mode === "satellite" && styles.satellite ? styles.satellite : styles.map;
  const { containerRef, map, status, flyTo } = usePropertyMap({ styleUrl, reducedMotion });

  const showPrice = mode !== "default";

  /**
   * Bucket the pins by where they land on screen, not by where they are on
   * earth — two properties a kilometre apart overlap at city zoom and are
   * distinct three zoom levels in, and only the projection knows that.
   */
  const groups: Group[] = useMemo(() => {
    if (!map) return [];
    const buckets = new Map<string, LocalizedProperty[]>();
    for (const property of properties) {
      const point = map.project([property.location.lng, property.location.lat]);
      const key = `${Math.round(point.x / CLUSTER_RADIUS)}:${Math.round(point.y / CLUSTER_RADIUS)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), property]);
    }

    return [...buckets].map(([key, items]) => ({
      key,
      at: {
        lat: items.reduce((sum, p) => sum + p.location.lat, 0) / items.length,
        lng: items.reduce((sum, p) => sum + p.location.lng, 0) / items.length,
      },
      items,
    }));
    // `moves` is the dependency that matters: `project()` reads the camera, and
    // the camera is not a React value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, properties, moves]);

  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => setMoves((count) => count + 1);
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [map]);

  const openProperty = useMemo(
    () => properties.find((property) => property.id === selected) ?? null,
    [properties, selected],
  );

  /** True while any listing on the map is only placed by its district. */
  const anyApproximate = properties.some((p) => p.location.precision === "approximate");

  if (status === "failed") {
    return (
      <div className="border-border bg-card flex min-h-[50vh] flex-col items-start justify-center gap-4 rounded-2xl border p-8">
        <p className="text-lg font-semibold tracking-tight">{labels.failedTitle}</p>
        <p className="text-muted-foreground max-w-[52ch] text-sm">{labels.failedBody}</p>
        <Link
          href={listHref}
          className="focus-visible:ring-ring rounded-sm border-b border-current pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          {labels.showList}
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-label={labels.region}
      data-map-ready={status === "ready" ? "1" : "0"}
      className="border-border relative isolate h-[62dvh] min-h-[26rem] overflow-hidden rounded-2xl border"
    >
      {/*
       * Sized directly, not with `absolute inset-0`. MapLibre's own stylesheet
       * sets `.maplibregl-map { position: relative }` and is imported after
       * Tailwind, so it wins on source order and the box collapsed to zero
       * height — a canvas with nothing to draw into and a `load` that never
       * fires. Giving it a real width and height sidesteps the cascade entirely.
       */}
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" ? (
        <p className="bg-muted text-muted-foreground absolute inset-0 grid place-items-center text-sm">
          {labels.loading}
        </p>
      ) : null}

      {map
        ? groups.map((group) =>
            group.items.length === 1 && group.items[0] ? (
              <MarkerPortal key={group.key} map={map} at={group.at}>
                <PropertyPin
                  price={formatCompactPrice(group.items[0].price, group.items[0].currency, locale)}
                  label={group.items[0].title}
                  showPrice={showPrice}
                  selected={selected === group.items[0].id}
                  onSelect={() => setSelected(group.items[0]?.id ?? null)}
                />
              </MarkerPortal>
            ) : (
              <MarkerPortal key={group.key} map={map} at={group.at}>
                <ClusterPin
                  count={group.items.length}
                  label={labels.clusterLabel.replace("{count}", String(group.items.length))}
                  // Two levels in is enough to separate a bucket without
                  // throwing the visitor across the city.
                  onSelect={() => flyTo(group.at, (map.getZoom() ?? CITY_ZOOM) + 2)}
                />
              </MarkerPortal>
            ),
          )
        : null}

      {/*
       * Top-left, not bottom-left as the reference has it: the map sits under a
       * page heading, a count and the neighbourhood strip, so its own bottom
       * edge is the first thing to fall below the fold. The caveat and the mode
       * control are the two things that must never be scrolled to.
       */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
        {anyApproximate ? (
          <p className="pointer-events-auto max-w-[22rem] rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-neutral-700 shadow-sm backdrop-blur">
            {labels.approximate}
          </p>
        ) : null}

        <div className="pointer-events-auto flex rounded-full border border-black/10 bg-white/90 p-1 shadow-md backdrop-blur">
          {(
            [
              ["default", labels.modeDefault],
              ["prices", labels.modePrices],
              // Nobody gives satellite imagery away. With no style configured the
              // choice is not offered rather than offered and broken.
              ...(styles.satellite ? ([["satellite", labels.modeSatellite]] as const) : []),
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "focus-visible:ring-ring rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors",
                "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none motion-reduce:transition-none",
                mode === value ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-black/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Link
        href={listHref}
        className="focus-visible:ring-ring absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap text-white uppercase shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {labels.showList}
      </Link>

      <div className="absolute top-4 right-4 z-10 flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/90 shadow-md backdrop-blur">
        <MapButton label={labels.zoomIn} onClick={() => map?.zoomIn()}>
          +
        </MapButton>
        <MapButton label={labels.zoomOut} onClick={() => map?.zoomOut()}>
          −
        </MapButton>
        <MapButton label={labels.recenter} onClick={() => flyTo(MARRAKECH, CITY_ZOOM)}>
          ⌖
        </MapButton>
      </div>

      {openProperty ? (
        <div className="absolute inset-x-4 bottom-20 z-20 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-80">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={labels.close}
              className="focus-visible:ring-ring absolute -top-2 -right-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-sm text-white shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span aria-hidden="true">×</span>
            </button>
            <PropertyCard
              property={openProperty}
              locale={locale}
              variant="quiet"
              labels={{
                ...cardLabels,
                type: typeLabels[openProperty.type] ?? openProperty.type,
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The zoom and recentre controls: a glyph anyone can read, a name only some need. */
function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-visible:ring-ring grid h-9 w-9 place-items-center text-base text-neutral-800 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
