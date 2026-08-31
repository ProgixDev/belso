import { Client } from "pg";

/**
 * Reset the rate limiters before an e2e run, when — and only when — the target
 * is a scratch database.
 *
 * **Why this exists.** The suite submits the enquiry form four times. The
 * enquiry throttle allows five stored submissions per hour per network, and
 * every request from a local run arrives with no forwarding header, so they all
 * count into one bucket. Run `pnpm e2e` twice inside an hour and the second run
 * fails on the sixth submission — with the form reporting a throttle, which
 * looks exactly like a broken enquiry form and is the limiter working
 * perfectly. It cost half an hour to diagnose once; this is so it does not cost
 * it again.
 *
 * **This is fixture hygiene, not a weakened gate.** No test asserts on
 * throttling — the two that do (`login-throttle.db.test.ts`) manage their own
 * counters and run in a different suite. Resetting a limiter between runs is
 * the same thing as starting from a known database, which the seed already
 * does for listings.
 *
 * The `_test` guard is the same one `playwright.config.ts` and
 * `vitest.db.setup.ts` use, for the same reason: this file issues a `delete`,
 * and a `delete` pointed at the client's database is the failure mode the whole
 * pattern exists to prevent. No `DATABASE_URL` at all means the run is on
 * fixtures and there is nothing to reset.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  const database = new URL(url).pathname.replace(/^\//, "");
  if (!/_test$|^test_|scratch/i.test(database)) {
    // Not an error: `BELSO_ALLOW_PROD_TESTS=1` is a deliberate escape hatch
    // elsewhere, and it must not turn into "and also wipe the throttles".
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("delete from enquiry_throttle");
    await client.query("delete from admin_login_throttle");
  } finally {
    await client.end();
  }
}
