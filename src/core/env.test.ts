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

  it("boots when production has everything", async () => {
    stubProduction();
    await expect(loadEnv()).resolves.toBeDefined();
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

  it("lets the Playwright production server past both guards", async () => {
    // `pnpm start` under Playwright is NODE_ENV=production and is not a
    // deployment. A real deploy never sets this, which is what keeps the guards
    // worth having.
    stubProduction();
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("THROTTLE_SECRET", undefined);
    vi.stubEnv("BELSO_ALLOW_FIXTURES", "1");
    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("does not guard development, where neither variable is expected", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("THROTTLE_SECRET", undefined);
    await expect(loadEnv()).resolves.toBeDefined();
  });
});
