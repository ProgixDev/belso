/**
 * Refuse to run the writing tests against the client's database.
 *
 * These tests unpublish a live listing to prove a draft is invisible, rename
 * one to prove an old address still resolves, and truncate `enquiry_throttle`.
 * They restore what they change in a `finally` — which holds right up until
 * someone presses Ctrl+C, or a machine sleeps mid-run, and a real listing stays
 * off the public catalogue with nobody knowing why.
 *
 * The only database that existed while this suite was written was the live one,
 * reached over an SSH tunnel, and `pnpm verify:db` pointed straight at it. It
 * also runs `db:seed`, which upserts every listing from the fixtures — so the
 * day after the back-office ships, one `pnpm verify:db` would silently revert
 * the client's own edits to her catalogue.
 *
 * So: the connection must name a database this suite is allowed to damage. Set
 * one up once (see `docs/security/vps.md`):
 *
 *   ssh belso-vps "docker exec belso-db-db-1 createdb -U belso belso_test"
 *   DATABASE_URL=postgres://belso:<password>@127.0.0.1:55432/belso_test pnpm verify:db
 *
 * `BELSO_ALLOW_PROD_TESTS=1` overrides, deliberately verbose, for the one case
 * where someone genuinely means it.
 */
import { beforeAll } from "vitest";

const ALLOWED = /_test$|^test_|scratch/i;

beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) return; // The suites skip themselves; nothing to guard.
  if (process.env.BELSO_ALLOW_PROD_TESTS === "1") return;

  // `new URL` handles the credentials and port; the pathname is `/<database>`.
  const database = new URL(url).pathname.replace(/^\//, "");

  if (!ALLOWED.test(database)) {
    throw new Error(
      `Refusing to run writing tests against the database "${database}".\n` +
        `  These tests unpublish and rename live listings and truncate the throttle table.\n` +
        `  Point DATABASE_URL at a scratch database whose name ends in _test, e.g.\n` +
        `    ssh belso-vps "docker exec belso-db-db-1 createdb -U belso belso_test"\n` +
        `  or set BELSO_ALLOW_PROD_TESTS=1 if you truly mean this one.`,
    );
  }
});
