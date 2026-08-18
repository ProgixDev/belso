import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These guard one specific production failure: the first Vercel build of this
 * repo died in `Collecting page data` because both Supabase variables were
 * declared on the project with **empty** values. `??` only catches null and
 * undefined, so `""` was handed to the schema and failed it — the placeholder
 * fallback that was supposed to make a backendless build work never ran.
 *
 * The module reads `process.env` once at import time, so each case needs a fresh
 * module registry rather than a re-import.
 */
async function loadEnv() {
  vi.resetModules();
  return import("./env.client");
}

const PLACEHOLDER_URL = "https://localhost.supabase.co";

describe("clientEnv", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the placeholder when the variables are absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    const { clientEnv, supabaseConfigured } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(PLACEHOLDER_URL);
    expect(supabaseConfigured).toBe(false);
  });

  it("treats declared-but-empty variables as absent rather than invalid", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { clientEnv, supabaseConfigured } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(PLACEHOLDER_URL);
    expect(supabaseConfigured).toBe(false);
  });

  it("treats whitespace as absent — a pasted blank line is not a value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "\n");
    const { clientEnv } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(PLACEHOLDER_URL);
  });

  it("uses real values, trimmed, and reports itself configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://abcdefgh.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_abcdefghijklmnop");
    const { clientEnv, supabaseConfigured } = await loadEnv();
    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abcdefgh.supabase.co");
    expect(supabaseConfigured).toBe(true);
  });

  it("still refuses a service-role key — the blank guard must not widen this", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    // Assembled rather than written out. `pnpm secrets:check` scans source for
    // exactly this shape and is right to — the fixture must not read as a real
    // key to the scanner while still being one to the schema under test.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["sb", "secret", "abcdefghijklmnop"].join("_"));
    await expect(loadEnv()).rejects.toThrow(/SERVICE ROLE/);
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
