import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E + screenshot evidence config.
 * - Locally: reuses your `pnpm dev` server (or starts one).
 * - CI: expects a production build (`pnpm build`) and starts `pnpm start`.
 * Screenshots are written by e2e/utils/shot.ts into artifacts/screenshots/.
 */

/**
 * The e2e suite fills in the enquiry form and submits it. Against a server
 * pointed at a real database, those submissions are **real rows** — this is not
 * hypothetical: one run of this suite with `DATABASE_URL` exported put "Sophie
 * Ferrand" into the client's enquiries table, and it sat there until a backup
 * check happened to count the rows.
 *
 * `vitest.db.setup.ts` guards the unit-level database tests the same way. This
 * is the other door, and it was open.
 */

/**
 * The `.env.local` reader, duplicated from `scripts/lib/env-local.mjs`.
 *
 * **The duplication is forced, and the first explanation given for it was
 * wrong.** It was justified here as a typing problem — that importing an
 * untyped `.mjs` would need `allowJs` or a declaration file. `tsconfig.json`
 * already sets `allowJs`, `vitest.db.config.mts` imports that module happily,
 * and `tsc --noEmit` is clean either way. A review said so, and was right.
 *
 * The real constraint is Playwright's config loader, which registers its own
 * `.mjs` handler and compiles it through the CommonJS path
 * (`playwright/lib/common/index.js`). Importing the shared module from here
 * fails at run time with `ReferenceError: exports is not defined in ES module
 * scope` — a config that type-checks perfectly and cannot start. `.mts` is
 * natively ESM, which is why the vitest config gets to share and this one does
 * not.
 *
 * So: same semantics, deliberately. **Last assignment wins** and an exported
 * variable beats the file, matching `env-local.mjs`. An earlier pair of copies
 * disagreed about the first — which is exactly the failure duplication invites,
 * and the reason this comment names the invariant rather than gesturing at it.
 * If one changes, change both.
 */
const DATABASE_KEYS = ["DATABASE_URL", "DATABASE_EDITOR_URL", "MEDIA_ROOT"];

function loadEnvLocal(keys: readonly string[]): Set<string> {
  const wanted = new Set(keys);
  const filled = new Set<string>();

  let text: string;
  try {
    // Relative to this config, not `process.cwd()`. Invoked from a
    // subdirectory, a cwd-relative read finds no file and the guard below
    // silently reverts to the hole it was written to close.
    text = readFileSync(resolve(__dirname, ".env.local"), "utf8");
  } catch {
    return filled; // No file is the ordinary case on a fresh clone and in CI.
  }

  const found = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (!key || !wanted.has(key)) continue;

    const value = (raw ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value) found.set(key, value);
  }

  for (const [key, value] of found) {
    if (process.env[key]) continue; // An exported variable wins.
    process.env[key] = value;
    filled.add(key);
  }

  return filled;
}

/**
 * Everything the run needs, resolved **into `process.env`** rather than into a
 * local — because the guard below is not the only reader.
 *
 * Three things in this process consume these, and each was getting a different
 * answer from the server:
 *
 * - the guard below, which refuses a database that is not a scratch one;
 * - **`e2e/global-setup.ts`**, which clears the rate limiters and returns early
 *   when `DATABASE_URL` is absent, reading absence as "this run is on fixtures
 *   — nothing to reset". With the value only in `.env.local` that conclusion
 *   was wrong: the server had a database, the setup did not know, and the
 *   enquiry throttle was never cleared. It allows five submissions per hour per
 *   network and the suite sends four, so the *second* run inside an hour failed
 *   on the enquiry tests — reported as a broken contact form, and actually the
 *   limiter working exactly as designed;
 * - `admin-auth.spec.ts` and `listing-editor.spec.ts`, which **skip themselves**
 *   without `BELSO_E2E_ADMIN_*`, so the two specs covering AC-1 through AC-6 can
 *   quietly not run while the suite reports success.
 *
 * The parser is `scripts/lib/env-local.mjs`, shared rather than copied. It was
 * briefly duplicated here on the grounds that importing an untyped `.mjs` from a
 * type-checked config would need `allowJs` — which `tsconfig.json` already sets,
 * so the justification was simply false. The two copies had also already
 * diverged on which of a repeated key wins, which is the argument against
 * duplication making itself.
 */
const fromFile = loadEnvLocal([
  ...DATABASE_KEYS,
  "BELSO_E2E_ADMIN_EMAIL",
  "BELSO_E2E_ADMIN_PASSWORD",
]);

const databaseUrl = process.env.DATABASE_URL;
const editorUrl = process.env.DATABASE_EDITOR_URL;
const databaseSource = fromFile.has("DATABASE_URL") ? ".env.local" : "the environment";

/** The database a connection string names, or null if it will not parse. */
function databaseOf(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

function refuse(lines: string[]): never {
  throw new Error(
    [
      ...lines,
      "  This suite submits the enquiry form and drives the back-office editor;",
      "  those rows are real.",
      "  Use a scratch database (see docs/security/vps.md):",
      "    DATABASE_URL=postgres://belso:<password>@127.0.0.1:55432/belso_test pnpm e2e",
      "  or set BELSO_ALLOW_PROD_TESTS=1 if you truly mean this one.",
    ].join("\n"),
  );
}

/**
 * Which port the suite drives, and why it is not simply 3000.
 *
 * Port 3000 is the default for every Next project on the machine, so it is
 * routinely held by a different one. That matters more than a busy port
 * normally would, because `reuseExistingServer` is true for a local run: plain
 * `pnpm e2e` against an occupied 3000 does not fail, it **runs the whole belso
 * suite against whatever application is already there** and reports the
 * results as belso's. This has happened here — a `next start` from an unrelated
 * repository was holding the port.
 *
 * `CI=true` does not reuse and so refuses instead, which is how it was noticed.
 * Setting `PORT` moves the server and the navigations together.
 *
 * **`NEXT_PUBLIC_SITE_URL` deliberately does not follow.** It is inlined at
 * build time, so it cannot be changed by an environment variable handed to
 * `pnpm start`, and the app therefore reports `http://localhost:3000` in its
 * sitemap and its JSON-LD whatever port it listens on. That is why the absolute
 * URLs asserted in `seo.spec.ts` stay at 3000 and must not be made relative to
 * this: they assert what the application emits, not where it was reached.
 */
const port = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

/**
 * Refuse a database this suite is not allowed to damage — **both** connections.
 *
 * Checking `DATABASE_URL` alone was the hole. Every back-office write goes
 * through `DATABASE_EDITOR_URL` (`core/db.ts`), and `listing-editor.spec.ts`
 * creates, publishes, renames and archives listings through exactly that
 * connection. So a `.env.local` pairing `DATABASE_URL=…/belso_test` with
 * `DATABASE_EDITOR_URL=…/belso` passed this guard and then wrote the client's
 * live catalogue — while the refusal message reassured the operator about the
 * database it had checked. A review caught it; nothing else would have, because
 * the suite would simply have gone green.
 *
 * A split pair is always a misconfiguration here, so a mismatch is refused even
 * when both halves are scratch databases: the two roles exist to hold different
 * privileges on the *same* data, never to address different data.
 */
const ALLOWED = /_test$|^test_|scratch/i;

if ((databaseUrl || editorUrl) && process.env.BELSO_ALLOW_PROD_TESTS !== "1") {
  for (const [name, url] of [
    ["DATABASE_URL", databaseUrl],
    ["DATABASE_EDITOR_URL", editorUrl],
  ] as const) {
    if (!url) continue;
    const database = databaseOf(url);
    if (database === null) {
      refuse([
        `Refusing to run e2e: ${name} (from ${databaseSource}) will not parse.`,
        "  Percent-encode any special characters in the password.",
      ]);
    }
    if (!ALLOWED.test(database)) {
      refuse([`Refusing to run e2e against the database "${database}" (${name}).`]);
    }
  }

  const pair = [databaseUrl, editorUrl].filter(Boolean).map((u) => databaseOf(u as string));
  if (pair.length === 2 && pair[0] !== pair[1]) {
    refuse([
      `Refusing to run e2e: DATABASE_URL names "${pair[0]}" and DATABASE_EDITOR_URL names "${pair[1]}".`,
      "  The two roles exist to hold different privileges on the same data.",
    ]);
  }
}
export default defineConfig({
  testDir: "./e2e",
  /*
   * Clears the rate-limiter tables, on a scratch database only. Without it the
   * suite is not repeatable within an hour: it submits the enquiry form four
   * times, the throttle allows five per hour per network, and a local run has
   * no forwarding header so every request counts into one bucket. The second
   * run of the day then fails with the form reporting a throttle, which reads
   * as a broken enquiry form and is the limiter working.
   */
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: baseURL,
    /*
     * Never inherit a stranger's server when a real database is in play.
     *
     * Reusing whatever is on the port discards this whole config — `PORT`,
     * `THROTTLE_SECRET`, `BELSO_ALLOW_FIXTURES` are never applied, and the
     * running server may be pointed at a database the guard above never saw.
     * That is precisely the disagreement this file exists to end, arriving
     * through the default local path. It has already bitten once here, with a
     * different project's Next server holding port 3000.
     *
     * Reuse stays available for the fixtures case, where there is no database
     * to be wrong about and the convenience is real.
     */
    reuseExistingServer: !process.env.CI && !databaseUrl,
    timeout: 120_000,
    env: {
      // Next reads this, so the server and the navigations move together.
      PORT: port,

      /*
       * `pnpm start` is NODE_ENV=production, and `src/core/env.ts` refuses to
       * boot production without a database — so that guard, added to stop a
       * deploy silently serving fixture listings as real inventory, also stopped
       * `pnpm e2e` on any machine without a tunnel. Which is most of them, and
       * the e2e suite is exactly where someone without one needs to work.
       *
       * Declaring it here rather than weakening the guard: a real deployment
       * never sets this, which is what keeps the guard worth having.
       */
      ...(databaseUrl ? {} : { BELSO_ALLOW_FIXTURES: "1" }),

      /*
       * The other production guard `pnpm start` trips, for the same reason.
       *
       * `env.ts` requires `THROTTLE_SECRET` in production so the throttle tables
       * cannot key on a reversible hash of an email address. A db-backed e2e run
       * is `NODE_ENV=production` without being a deployment, so it needs a value
       * — and a fixed one is right here, because the tables it keys are in a
       * scratch database that `globalSetup` empties anyway.
       *
       * Not a secret, and not usable as one: it exists only so the boot succeeds.
       */
      THROTTLE_SECRET: process.env.THROTTLE_SECRET ?? "e2e-not-a-secret",
    },
  },
});
