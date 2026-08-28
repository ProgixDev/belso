import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These guard one specific production failure: the first Vercel build of this
 * repo died in `Collecting page data` because two public variables were declared
 * on the project with **empty** values. `??` only catches null and undefined, so
 * "" reached the schema and failed it, and the fallback that was supposed to make
 * a keyless build work never ran.
 *
 * Those were the Supabase variables, which ADR-0008 removed. The lesson is not
 * about Supabase — it is about `configured()`, which the map style URLs now use
 * in exactly the same way — so these were retargeted rather than deleted.
 *
 * The module reads `process.env` once at import time, so each case needs a fresh
 * module registry rather than a re-import.
 */
async function loadEnv() {
  vi.resetModules();
  return import("./env.client");
}

const DEMO_TILES = "https://demotiles.maplibre.org/style.json";

describe("clientEnv", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the default when the variable is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", undefined);
    const { clientEnv, usingDemoTiles } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_MAP_STYLE_URL).toBe(DEMO_TILES);
    expect(usingDemoTiles).toBe(true);
  });

  it("treats a declared-but-empty variable as absent rather than invalid", async () => {
    // The exact shape of the failure: a variable declared on the project with
    // no value.  catches null and undefined, not "".
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "");
    const { clientEnv, usingDemoTiles } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_MAP_STYLE_URL).toBe(DEMO_TILES);
    expect(usingDemoTiles).toBe(true);
  });

  it("treats whitespace as absent — a pasted blank line is not a value", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL", "\n");
    const { clientEnv, satelliteAvailable } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_MAP_STYLE_URL).toBe(DEMO_TILES);
    // And the control that depends on it stays hidden rather than broken.
    expect(satelliteAvailable).toBe(false);
  });

  it("uses a real value, trimmed, and reports itself configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", " https://tiles.example.com/style.json ");
    const { clientEnv, usingDemoTiles } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_MAP_STYLE_URL).toBe("https://tiles.example.com/style.json");
    expect(usingDemoTiles).toBe(false);
  });
});

describe("site.url", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadSite() {
    vi.resetModules();
    return import("./site");
  }

  it("prefers the configured site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://belso.ma");
    const { site } = await loadSite();
    expect(site.url).toBe("https://belso.ma");
  });

  it("falls back to the Vercel production domain, not localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "belso.vercel.app");
    const { site } = await loadSite();
    expect(site.url).toBe("https://belso.vercel.app");
  });

  it("is always a URL `new URL()` accepts — the root layout calls it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    const { site } = await loadSite();
    expect(() => new URL(site.url)).not.toThrow();
    expect(site.url).toBe("http://localhost:3000");
  });
});
