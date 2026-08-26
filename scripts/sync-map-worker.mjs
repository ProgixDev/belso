#!/usr/bin/env node
/**
 * Copy MapLibre's worker out of `node_modules` and into `public/`.
 *
 * MapLibre v6 starts its worker as an ES module — `new Worker(url, { type:
 * "module" })` — and **Turbopack does not emit that worker chunk correctly**.
 * The symptom is quiet and expensive to chase: the style loads, `sourcedata`
 * fires, no tile is ever parsed, and `load` never fires at all, so the map sits
 * on its loading state forever with a working WebGL canvas behind it and
 * nothing in the console.
 *
 * Serving the worker ourselves and pointing `setWorkerUrl` at it sidesteps the
 * bundler entirely (`use-property-map.ts`). Two files, because the worker
 * imports the shared chunk by a relative path — they have to sit together.
 *
 * The copies are committed so a fresh clone works without running anything, and
 * this script re-runs before every build: if the dependency is upgraded and the
 * copies drift, the next build rewrites them and the diff says so out loud.
 */
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "vendor", "maplibre");

// The worker imports the shared chunk relatively, so both must land together.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(from)) {
  console.error("sync-map-worker: maplibre-gl is not installed — run `pnpm install` first.");
  process.exit(1);
}

const version = JSON.parse(
  readFileSync(join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"),
).version;

mkdirSync(to, { recursive: true });
for (const file of FILES) copyFileSync(join(from, file), join(to, file));

console.log(`sync-map-worker ✓ maplibre-gl ${version} → public/vendor/maplibre/`);
