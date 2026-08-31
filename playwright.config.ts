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
 * Read one variable out of `.env.local`, because **the guard below has to judge
 * the value the server will use, not the one this process happens to see.**
 *
 * This is the hole a security review found, and it was the whole guard. The
 * server under test is `pnpm start`, and Next loads `.env.local` itself —
 * Playwright never sees that file. So a machine set up exactly as
 * `HANDOFF.md` instructs, with `DATABASE_URL` in `.env.local` and nothing
 * exported, made `process.env.DATABASE_URL` undefined here. The check below was
 * skipped as "no database", `BELSO_ALLOW_FIXTURES=1` was passed to a server
 * that then connected to a real one, and the suite would have submitted live
 * enquiries with the guard reporting nothing. Which is the incident it was
 * written after.
 *
 * Parsed rather than imported: `@next/env` is in the tree only as a transitive
 * dependency of `next`, and taking a direct dependency on a package for one
 * variable read is a worse trade than fifteen lines.
 *
 * Precedence matches Next's: an exported variable wins over the file.
 */
function fromEnvLocal(key: string): string | undefined {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return undefined; // No file is the ordinary case on a fresh clone.
  }

  // Last assignment wins, as dotenv-style loaders do for a repeated key.
  let found: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || match[1] !== key) continue;
    found = (match[2] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return found || undefined;
}

/**
 * Everything the run needs, resolved **into `process.env`** rather than into a
 * local — because the guard below is not the only reader.
 *
 * Three things in this process consume these, and each one was getting a
 * different answer from the server:
 *
 * - the guard below, which refuses a database that is not a scratch one;
 * - **`e2e/global-setup.ts`**, which clears the rate limiters and returns early
 *   when `DATABASE_URL` is absent, reading absence as "this run is on
 *   fixtures — nothing to reset". With the value only in `.env.local` that
 *   conclusion was wrong: the server had a database, the setup did not know,
 *   and the enquiry throttle was never cleared. It allows five submissions per
 *   hour per network and the suite sends four, so the *second* run inside an
 *   hour failed on the enquiry tests — reported as a broken contact form, and
 *   actually the limiter working exactly as designed. The file's own docstring
 *   describes this failure and it happened anyway, one layer up;
 * - `admin-auth.spec.ts` and `listing-editor.spec.ts`, which **skip themselves**
 *   without `BELSO_E2E_ADMIN_*`. That is the right behaviour — a contributor
 *   with no tunnel should not be blocked — but it means the two specs covering
 *   AC-1 through AC-6 can quietly not run while the suite reports success.
 *
 * One resolution, applied to the whole process, so the tests, the setup and the
 * server cannot disagree about which database they are pointed at.
 */
const fromFile = new Set<string>();
for (const key of [
  "DATABASE_URL",
  "DATABASE_EDITOR_URL",
  "BELSO_E2E_ADMIN_EMAIL",
  "BELSO_E2E_ADMIN_PASSWORD",
]) {
  if (process.env[key]) continue;
  const value = fromEnvLocal(key);
  if (value === undefined) continue;
  process.env[key] = value;
  fromFile.add(key);
}

const databaseUrl = process.env.DATABASE_URL;
const databaseSource = fromFile.has("DATABASE_URL") ? ".env.local" : "the environment";

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

if (databaseUrl && process.env.BELSO_ALLOW_PROD_TESTS !== "1") {
  const database = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!/_test$|^test_|scratch/i.test(database)) {
    throw new Error(
      `Refusing to run e2e against the database "${database}" (from ${databaseSource}).\n` +
        `  This suite submits the enquiry form; those rows are real.\n` +
        `  Use a scratch database (see docs/security/vps.md):\n` +
        `    DATABASE_URL=postgres://belso:<password>@127.0.0.1:55432/belso_test pnpm e2e\n` +
        `  or set BELSO_ALLOW_PROD_TESTS=1 if you truly mean this one.`,
    );
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
    reuseExistingServer: !process.env.CI,
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
