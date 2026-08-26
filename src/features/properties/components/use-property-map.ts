"use client";

// v6 ships named exports only — there is no default to import.
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "../types";

/**
 * The map's imperative life, kept out of the component that draws over it.
 *
 * The split mirrors `use-cinematic-scroll.ts`: one effect owns the instance from
 * creation to `remove()`, and React never re-renders because the map moved. What
 * React owns is the *set* of markers; the map owns where each one sits, which is
 * what `maplibregl.Marker` is for.
 */

/** Marrakech, at a zoom that holds the city and the roads out of it. */
export const MARRAKECH: Coordinates = { lat: 31.63, lng: -7.99 };
export const CITY_ZOOM = 11.2;

export type MapStatus = "loading" | "ready" | "failed";

/**
 * Serve MapLibre's worker from our own origin instead of letting the bundler
 * emit it.
 *
 * v6 starts the worker as an ES module, and **Turbopack does not emit that
 * chunk correctly**. The failure is silent and cost an afternoon: the style
 * loads, `sourcedata` fires, no tile is ever parsed, `load` never fires, and
 * the map sits on its loading state behind a perfectly good WebGL canvas with
 * nothing in the console to explain it. CSP and WebGL were both ruled out
 * before the worker was.
 *
 * `scripts/sync-map-worker.mjs` keeps the copy in step with the dependency, and
 * a same-origin worker means the CSP needs `worker-src 'self'` rather than
 * `blob:` — a tighter policy than the one this started with.
 */
maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

export function usePropertyMap({
  styleUrl,
  reducedMotion,
}: {
  styleUrl: string;
  /** Read at call time, so a mid-session system change is honoured. */
  reducedMotion: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  // The style the instance was built with. Kept in a ref so creating the map is
  // genuinely a mount-only effect: swapping styles is `setStyle`, below.
  const appliedStyle = useRef(styleUrl);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = new maplibregl.Map({
      container,
      style: appliedStyle.current,
      center: [MARRAKECH.lng, MARRAKECH.lat],
      zoom: CITY_ZOOM,
      // The map says where things are; it is not a viewing angle. Pitch and
      // rotation add two gestures and two ways to get lost, for nothing here.
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: false,
      attributionControl: { compact: true },
    });

    mapRef.current = instance;

    const onLoad = () => {
      setStatus("ready");
      setMap(instance);
    };

    /*
     * A style that will not load is the one broken state a visitor can actually
     * hit — a wrong key, a provider outage, a blocked host. It has to say so and
     * offer the list, rather than leaving a grey rectangle on the page.
     */
    const onError = (event: maplibregl.ErrorEvent) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403 || status === 404) setStatus("failed");
    };

    instance.on("load", onLoad);
    instance.on("error", onError);

    return () => {
      instance.off("load", onLoad);
      instance.off("error", onError);
      mapRef.current = null;
      setMap(null);
      /*
       * Frees the WebGL context. Without it, switching to the list and back
       * enough times exhausts the browser's context limit and the map quietly
       * stops drawing, with no error anyone would connect to the cause.
       */
      instance.remove();
    };
  }, []);

  /*
   * Satellite and back. `setStyle` keeps the camera and every `Marker`, because
   * markers here are DOM the map positions rather than layers the style owns —
   * which is the whole reason the pins are HTML and not a GL layer.
   */
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || status !== "ready" || appliedStyle.current === styleUrl) return;
    appliedStyle.current = styleUrl;
    instance.setStyle(styleUrl);
  }, [styleUrl, status]);

  /** Honour the system setting on every camera move a control makes. */
  const flyTo = (center: Coordinates, zoom?: number) => {
    const instance = mapRef.current;
    if (!instance) return;
    const target = { center: [center.lng, center.lat] as [number, number], zoom };
    if (reducedMotion) instance.jumpTo(target);
    else instance.easeTo({ ...target, duration: 550 });
  };

  return { containerRef, map, status, flyTo };
}
