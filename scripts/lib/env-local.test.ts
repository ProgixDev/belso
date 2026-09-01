import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Resolved by `allowJs`, which is why this import needs no suppression — the
// reason playwright.config.ts still cannot share it is its loader, not types.
import { DATABASE_KEYS, loadEnvLocal } from "./env-local.mjs";

/**
 * The parser that decides which database everything talks to.
 *
 * `migrate`, `seed`, `admin-user` and `pnpm test:db` all resolve their
 * connection through this, and `seed` upserts the client's entire catalogue. It
 * had no tests, which a review called out: the semantics below are load-bearing
 * and every one of them was an assumption.
 *
 * The allow-list cases are the security ones. An earlier version lifted every
 * key it found, which meant `BELSO_ALLOW_PROD_TESTS=1` written into
 * `.env.local` would satisfy the scratch-database guard permanently and
 * invisibly — and the guard's own error message tells the operator to set that
 * variable, while `HANDOFF.md` teaches that setting a variable means writing it
 * into that file.
 */

let dir: string;
let file: string;

/**
 * The keys these cases move, saved and restored by hand.
 *
 * `vi.unstubAllEnvs()` undoes `vi.stubEnv`, and this module does not stub — it
 * assigns to `process.env` directly, which is the whole point of it. So without
 * this the first case that sets `DATABASE_URL` leaves it set, and every later
 * case hits the "an exported variable wins" branch and reads as a failure of
 * the parser rather than of the fixture. Six of them did, first run.
 */
const TOUCHED = [
  "DATABASE_URL",
  "DATABASE_EDITOR_URL",
  "MEDIA_ROOT",
  "BELSO_ALLOW_PROD_TESTS",
  "BELSO_ALLOW_FIXTURES",
];
let saved: Record<string, string | undefined>;

function envFile(contents: string) {
  writeFileSync(file, contents, "utf8");
  return file;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "belso-envlocal-"));
  file = join(dir, ".env.local");
  vi.unstubAllEnvs();
  saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
  for (const k of TOUCHED) delete process.env[k];
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("loadEnvLocal", () => {
  it("reads a bare KEY=value", () => {
    loadEnvLocal(["DATABASE_URL"], { file: envFile("DATABASE_URL=postgres://x/belso_test\n") });
    expect(process.env.DATABASE_URL).toBe("postgres://x/belso_test");
  });

  it("strips an export prefix", () => {
    loadEnvLocal(["DATABASE_URL"], { file: envFile("export DATABASE_URL=postgres://x/a_test\n") });
    expect(process.env.DATABASE_URL).toBe("postgres://x/a_test");
  });

  it("strips one pair of quotes and no more", () => {
    loadEnvLocal(["MEDIA_ROOT"], { file: envFile(`MEDIA_ROOT="'/srv/media'"\n`) });
    expect(process.env.MEDIA_ROOT).toBe("'/srv/media'");
  });

  it("takes the last of two assignments to one key", () => {
    // Matches playwright.config.ts's copy, which documents the same rule. The
    // two disagreed about this once; that is why it is asserted.
    loadEnvLocal(["MEDIA_ROOT"], { file: envFile("MEDIA_ROOT=/first\nMEDIA_ROOT=/second\n") });
    expect(process.env.MEDIA_ROOT).toBe("/second");
  });

  it("treats KEY= as unset", () => {
    loadEnvLocal(["MEDIA_ROOT"], { file: envFile("MEDIA_ROOT=\n") });
    expect(process.env.MEDIA_ROOT).toBeUndefined();
  });

  it("ignores a commented line", () => {
    loadEnvLocal(["MEDIA_ROOT"], { file: envFile("# MEDIA_ROOT=/commented\n") });
    expect(process.env.MEDIA_ROOT).toBeUndefined();
  });

  it("leaves an already-exported variable alone", () => {
    vi.stubEnv("MEDIA_ROOT", "/exported");
    const filled = loadEnvLocal(["MEDIA_ROOT"], { file: envFile("MEDIA_ROOT=/from-file\n") });
    expect(process.env.MEDIA_ROOT).toBe("/exported");
    expect(filled.has("MEDIA_ROOT")).toBe(false);
  });

  it("returns the keys it filled, and only those", () => {
    const filled = loadEnvLocal(["MEDIA_ROOT", "DATABASE_URL"], {
      file: envFile("MEDIA_ROOT=/srv\n"),
    });
    expect([...filled]).toEqual(["MEDIA_ROOT"]);
  });

  it("returns nothing when the file is absent", () => {
    const filled = loadEnvLocal(["DATABASE_URL"], { file: join(dir, "nope.local") });
    expect([...filled]).toEqual([]);
  });

  it("will not carry a variable that disables a guard", () => {
    /*
     * The security property, stated as a test. `BELSO_ALLOW_PROD_TESTS` and
     * `BELSO_ALLOW_FIXTURES` waive the protections standing between a test run
     * and the client's live catalogue. They must be a per-run decision that
     * somebody typed, not a line in a file that outlives the reason for it.
     */
    loadEnvLocal(undefined, {
      file: envFile(
        "BELSO_ALLOW_PROD_TESTS=1\nBELSO_ALLOW_FIXTURES=1\nDATABASE_URL=postgres://x/a_test\n",
      ),
    });

    expect(process.env.BELSO_ALLOW_PROD_TESTS).toBeUndefined();
    expect(process.env.BELSO_ALLOW_FIXTURES).toBeUndefined();
    expect(process.env.DATABASE_URL).toBe("postgres://x/a_test");
  });

  it("defaults to connection details only", () => {
    expect(DATABASE_KEYS).toEqual(["DATABASE_URL", "DATABASE_EDITOR_URL", "MEDIA_ROOT"]);
  });
});
