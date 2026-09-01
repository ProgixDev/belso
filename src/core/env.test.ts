import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The two production guards in `env.ts`, and nothing else.
 *
 * Both exist because a variable missing from a deploy is otherwise silent — the
 * site boots, serves, and is wrong in a way nobody looks for. Both were also
 * written as a docstring first and a guard later: `THROTTLE_SECRET` spent a
 * release with `login-throttle.ts` asserting that "env.ts says production must
 * set it" while env.ts said no such thing. That is what these tests are really
 * pinning — not the throw, but the agreement between the throw and every
 * comment that relies on it.
 *
 * The module reads `process.env` and runs its guards once at import time, so
 * each case needs a fresh module registry rather than a re-import.
 */
async function loadEnv() {
  vi.resetModules();
  return import("./env");
}

/** A production boot with everything the guards want, minus what a case removes. */
function stubProduction() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PHASE", undefined);
  vi.stubEnv("BELSO_ALLOW_FIXTURES", undefined);
  vi.stubEnv("DATABASE_URL", "postgres://belso:secret@127.0.0.1:5432/belso");
  vi.stubEnv("THROTTLE_SECRET", "a-real-secret");
}

describe("env production guards", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("boots when production has everything, and keeps the values", async () => {
    // `resolves.toBeDefined()` alone asserts that a module object exists, which
    // would hold if the schema dropped every field. Read one back.
    stubProduction();
    const { env } = await loadEnv();
    expect(env.THROTTLE_SECRET).toBe("a-real-secret");
    expect(env.DATABASE_URL).toContain("/belso");
  });

  it("refuses to boot production without a database", async () => {
    stubProduction();
    vi.stubEnv("DATABASE_URL", undefined);
    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL is required in production/);
  });

  it("refuses to boot production without a throttle secret", async () => {
    // Unset, both limiters key on a bare sha256 of `login:account:<email>` and
    // of an IP prefix — so the tables that exist to stop enumeration become the
    // enumeration list for anyone holding a backup.
    stubProduction();
    vi.stubEnv("THROTTLE_SECRET", undefined);
    await expect(loadEnv()).rejects.toThrow(/THROTTLE_SECRET is required in production/);
  });

  it("treats a declared-but-empty throttle secret as absent", async () => {
    // The exact shape of the Vercel failure this file's neighbour records: a
    // variable declared on the deploy with no value. An empty HMAC key would
    // otherwise pass the guard and hash exactly as badly as no key at all.
    stubProduction();
    vi.stubEnv("THROTTLE_SECRET", "   ");
    await expect(loadEnv()).rejects.toThrow(/THROTTLE_SECRET is required in production/);
  });

  it("lets `next build` past both guards", async () => {
    // The build sets NODE_ENV=production itself, on machines that correctly
    // have neither a database nor a secret. Guarding it would make `pnpm
    // verify` impossible to pass.
    stubProduction();
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("THROTTLE_SECRET", undefined);
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("lets the Playwright production server past the database guard", async () => {
    // `pnpm start` under Playwright is NODE_ENV=production and is not a
    // deployment. A real deploy never sets this, which is what keeps the guard
    // worth having.
    stubProduction();
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("BELSO_ALLOW_FIXTURES", "1");
    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("does NOT let the fixtures hatch past the throttle guard", async () => {
    /*
     * This case previously asserted the opposite, and pinning that was the
     * defect: `next start` loads .env.local, so a deploy carrying
     * BELSO_ALLOW_FIXTURES=1 there would have waived a security requirement
     * that has nothing to do with fixtures. Nothing legitimate needs it —
     * playwright.config.ts supplies THROTTLE_SECRET in both its branches.
     */
    stubProduction();
    vi.stubEnv("THROTTLE_SECRET", undefined);
    vi.stubEnv("BELSO_ALLOW_FIXTURES", "1");
    await expect(loadEnv()).rejects.toThrow(/THROTTLE_SECRET is required in production/);
  });

  it("treats a declared-but-empty DATABASE_URL as absent", async () => {
    // The docstring cites this exact Vercel failure — a variable declared on the
    // deploy with no value — and only THROTTLE_SECRET had it pinned.
    stubProduction();
    vi.stubEnv("DATABASE_URL", "   ");
    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL is required in production/);
  });

  it("refuses a DATABASE_URL that is not a postgres URL", async () => {
    stubProduction();
    vi.stubEnv("DATABASE_URL", "mysql://nope/belso");
    await expect(loadEnv()).rejects.toThrow(/postgres/i);
  });

  it("warns, but does not throw, when production has no editor connection", async () => {
    /*
     * ADR-0010 written as a test, in both directions. Without DATABASE_URL the
     * storefront would lie to visitors, so it must not boot; without the editor
     * connection the storefront is entirely correct and only the back-office is
     * unavailable, so refusing to boot would take a working public site down to
     * protect three people’s editor. Deleting the whole warn block left every
     * case green before this one existed.
     */
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubProduction();
    vi.stubEnv("DATABASE_EDITOR_URL", undefined);

    await expect(loadEnv()).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DATABASE_EDITOR_URL is not set"));

    warn.mockRestore();
  });

  it("resolves the media root, and defaults it", async () => {
    // Getting this wrong loses the client’s photography on the next deploy, per
    // the variable’s own docstring, and nothing asserted either half.
    stubProduction();
    vi.stubEnv("MEDIA_ROOT", undefined);
    const { mediaRoot } = await loadEnv();
    expect(mediaRoot).toMatch(/media$/);

    // Separators normalised rather than matched: this runs on Windows and on
    // the VPS, and the assertion is about resolution, not about which slash.
    vi.resetModules();
    vi.stubEnv("MEDIA_ROOT", "srv/photos");
    const again = await loadEnv();
    expect(again.mediaRoot.split(/[\\/]/).slice(-2).join("/")).toBe("srv/photos");
    // Relative, so it resolves against the working directory rather than being
    // taken literally — the docstring's whole point.
    expect(again.mediaRoot).toContain(process.cwd().split(/[\\/]/).pop() ?? "");
  });

  it("does not guard development, where neither variable is expected", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("THROTTLE_SECRET", undefined);
    await expect(loadEnv()).resolves.toBeDefined();
  });
});
