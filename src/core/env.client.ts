import { z } from "zod";

/**
 * Client-side environment access. Everything here is `NEXT_PUBLIC_*` and is
 * inlined into the browser bundle, so **nothing secret may ever be added** —
 * `pnpm secrets:check` enforces the naming half of that, and review the rest.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url("NEXT_PUBLIC_MAP_STYLE_URL must be a valid URL"),
  NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL: z
    .string()
    .url("NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL must be a valid URL")
    .optional(),
});

/**
 * A variable *declared with an empty value* is not a configured value.
 *
 * This is the whole lesson of the first failed Vercel deploy: `??` catches null
 * and undefined, so `""` sailed past the fallback and into the schema, which
 * rejected it and killed the build in `Collecting page data`. Trimming first
 * also means a pasted blank line reads as absent, which is what the person who
 * pasted it meant. `env.client.test.ts` pins all three cases.
 */
function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * MapLibre's own demo style: keyless, openly licensed, and low detail — land,
 * water and borders, no street names at city zoom.
 *
 * It is the default so the map needs **no account to develop against** and no
 * key to run the tests, which is the same standard `packs/README.md` holds the
 * feature packs to. It is not a launch style: `pnpm web:check` flags it, the way
 * it flags a placeholder site URL.
 */
const DEMO_MAP_STYLE = "https://demotiles.maplibre.org/style.json";

// NEXT_PUBLIC_* must be referenced statically for Next.js to inline them.
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_MAP_STYLE_URL: configured(process.env.NEXT_PUBLIC_MAP_STYLE_URL) ?? DEMO_MAP_STYLE,
  // No default. Nobody gives satellite imagery away, so an unset variable means
  // we have none — and the control for it is not rendered rather than offered
  // and broken.
  NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL: configured(process.env.NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL),
});

/**
 * The two style URLs the map draws with, and whether the ground can be swapped.
 *
 * `usingDemoTiles` is what `web:check` reads: shipping a launch on MapLibre's
 * demo server would be running production traffic through somebody's goodwill.
 */
export const mapStyles = {
  map: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL,
  satellite: clientEnv.NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL,
} as const;

export const satelliteAvailable = Boolean(clientEnv.NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL);
export const usingDemoTiles = clientEnv.NEXT_PUBLIC_MAP_STYLE_URL === DEMO_MAP_STYLE;
