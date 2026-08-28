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
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && process.env.BELSO_ALLOW_PROD_TESTS !== "1") {
  const database = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!/_test$|^test_|scratch/i.test(database)) {
    throw new Error(
      `Refusing to run e2e against the database "${database}".\n` +
        `  This suite submits the enquiry form; those rows are real.\n` +
        `  Use a scratch database (see docs/security/vps.md):\n` +
        `    DATABASE_URL=postgres://belso:<password>@127.0.0.1:55432/belso_test pnpm e2e\n` +
        `  or set BELSO_ALLOW_PROD_TESTS=1 if you truly mean this one.`,
    );
  }
}
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
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
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
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
    },
  },
});
