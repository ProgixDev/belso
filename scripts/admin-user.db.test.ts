import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `admin-user.mjs`, driven as it is actually run.
 *
 * **Why the whole script rather than the function.** `revokeSessions()` is the
 * implementation of SEC-AUTH-002 — "anything that invalidates a credential
 * destroys the sessions issued under it" — and it had no test of any kind. It is
 * also a `delete` whose safety argument (`select id` rather than a join, "so a
 * typo'd address deletes nothing instead of everything") was asserted nowhere.
 * Importing the function would not exercise the `begin`/`commit` around it, nor
 * the `on conflict` branch that decides whether a create is really a password
 * change, and those are where the reasoning lives.
 *
 * The gap it closes is a real one that shipped: `password` used to leave every
 * session from the old password alive for its full seven days, which is exactly
 * backwards for the command you reach for when you think somebody else has the
 * account.
 *
 * Sessions are inserted as rows rather than through `createSession()`, which
 * needs `cookies()` from a request scope. The rows are what the script deletes,
 * so they are what the test should make.
 */

const exec = promisify(execFile);

const url = process.env.DATABASE_URL;
const describeMaybe = url ? describe : describe.skip;

/** Unique per run, so a crashed run leaves nothing for the next one to trip on. */
const MARK = randomBytes(4).toString("hex");
const EMAIL = `revoke-${MARK}@belso.ma`;
const OTHER = `bystander-${MARK}@belso.ma`;

let client: Client;

async function run(...args: string[]) {
  return exec(
    "node",
    ["--import", "./scripts/lib/ts-alias-hook.mjs", "scripts/admin-user.mjs", ...args],
    { env: { ...process.env, DATABASE_URL: url }, cwd: process.cwd() },
  );
}

async function seedAccount(email: string) {
  const { rows } = await client.query<{ id: string }>(
    `insert into admin_users (email, password_hash, display_name)
     values ($1, 'scrypt$32768$8$1$c2FsdA==$a2V5', $2)
     on conflict (lower(email)) do update set display_name = excluded.display_name
     returning id`,
    [email, `Test ${MARK}`],
  );
  return rows[0]!.id;
}

async function giveSessions(userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await client.query(
      `insert into admin_sessions (token_sha256, user_id, expires_at)
       values ($1, $2, now() + interval '7 days')`,
      [randomBytes(32), userId],
    );
  }
}

async function sessionCount(userId: string) {
  const { rows } = await client.query<{ count: string }>(
    "select count(*)::text as count from admin_sessions where user_id = $1",
    [userId],
  );
  return Number(rows[0]!.count);
}

describeMaybe("admin-user revokes sessions (SEC-AUTH-002)", () => {
  /*
   * Each case spawns node with the TypeScript alias hook and hashes a password
   * with scrypt at production cost. Five seconds is not enough, and the failure
   * reads as a hung script rather than a slow one.
   */
  const TIMEOUT = 30_000;

  beforeAll(async () => {
    client = new Client({ connectionString: url });
    await client.connect();
  });

  afterAll(async () => {
    await client.query("delete from admin_users where email in ($1, $2)", [EMAIL, OTHER]);
    await client.end();
  }, TIMEOUT);

  it(
    "a password change destroys every session issued under the old one",
    async () => {
      const id = await seedAccount(EMAIL);
      await giveSessions(id, 3);
      expect(await sessionCount(id)).toBe(3);

      const { stdout } = await run("password", EMAIL);

      expect(await sessionCount(id)).toBe(0);
      // Reported, not silent: the operator must be able to see it happened.
      expect(stdout).toContain("3 existing session(s) signed out");
    },
    TIMEOUT,
  );

  it(
    "creating over an existing account revokes too — it is a password change",
    async () => {
      // The `on conflict` branch. It used to be gated on `(xmax = 0)`, a heap
      // internal whose unsafe failure direction leaves live sessions behind.
      const id = await seedAccount(EMAIL);
      await giveSessions(id, 2);

      await run("create", EMAIL, "Test Person");

      expect(await sessionCount(id)).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "disabling revokes",
    async () => {
      const id = await seedAccount(EMAIL);
      await giveSessions(id, 2);

      await run("disable", EMAIL);

      expect(await sessionCount(id)).toBe(0);
      await run("enable", EMAIL);
    },
    TIMEOUT,
  );

  it(
    "a misspelt address revokes nothing at all",
    async () => {
      /*
       * The claim in the docstring, asserted: `select id … where lower(email) =
       * lower($1)` matches no account for a typo, so the subquery is empty and the
       * delete touches nothing. A join written the obvious way could have deleted
       * every session in the table.
       */
      const kept = await seedAccount(OTHER);
      await giveSessions(kept, 2);

      await expect(run("password", `${EMAIL}.typo`)).rejects.toThrow();

      expect(await sessionCount(kept)).toBe(2);
    },
    TIMEOUT,
  );

  it(
    "matches the account whatever the capitalisation",
    async () => {
      const id = await seedAccount(EMAIL);
      await giveSessions(id, 1);

      await run("password", EMAIL.toUpperCase());

      expect(await sessionCount(id)).toBe(0);
    },
    TIMEOUT,
  );
});
