/**
 * Prove that a back-office password actually signs in, without printing it
 * (spec 013, T-07b).
 *
 * `belso-admin-user.sh` writes a password on the VPS and never shows it, which
 * leaves an obvious question: how does anybody know it works? "The command
 * exited zero" is not an answer — it means a row was written, not that the row
 * can be signed in against.
 *
 * So this re-reads the stored hash and runs **`verifyPassword`, the same
 * function `signInAction` calls**, against the password that was just written.
 * That is the whole of the sign-in check minus the rate limiter and the cookie,
 * and it is the strongest proof available before the site is deployed.
 *
 * Runs on the box, inside the `belso-deps` image, with `src/` mounted:
 *
 *   DATABASE_URL=… PGPASSWORD=… EMAIL=… CANDIDATE=… node scripts/vps/check-admin-password.mjs
 *
 * Prints one word — OK, MISMATCH, DISABLED or NO-ROW — and never the password.
 * The caller turns that into a verdict; keeping the decision in the shell means
 * this file has one job and no exit-code vocabulary to remember.
 */
import pg from "pg";

import { verifyPassword } from "../../src/features/admin/password.ts";

const { DATABASE_URL, EMAIL, CANDIDATE } = process.env;

if (!DATABASE_URL || !EMAIL || !CANDIDATE) {
  console.error("check-admin-password: needs DATABASE_URL, EMAIL and CANDIDATE in the environment");
  process.exit(1);
}

/*
 * The password arrives in the environment rather than as an argument: an
 * argument is visible in `ps` to every other process on the box, which on this
 * one includes the client's n8n.
 */
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

try {
  const { rows } = await client.query(
    "select password_hash, disabled_at from admin_users where lower(email) = lower($1)",
    [EMAIL],
  );

  if (rows.length !== 1) {
    console.log("NO-ROW");
  } else if (!(await verifyPassword(CANDIDATE, rows[0].password_hash))) {
    console.log("MISMATCH");
  } else {
    /*
     * A verifying password on a disabled account is still a failed sign-in:
     * `currentSession` and the sign-in action both check `disabled_at`. Reported
     * separately because the fix is different — `enable`, not a new password.
     */
    console.log(rows[0].disabled_at ? "DISABLED" : "OK");
  }
} finally {
  await client.end();
}
