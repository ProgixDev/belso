import "server-only";
import { createHash, createHmac } from "node:crypto";
import { editorQuery } from "@/core/db";
import { env } from "@/core/env";
import { networkOf } from "@/lib/network";

/**
 * Rate limiting for sign-in, on two axes, because either alone leaves a hole
 * (AC-9).
 *
 * **By network**, or one machine grinds through a password list unopposed.
 * **By account**, or a botnet spread across a thousand addresses grinds through
 * one person's — every request from a fresh address, every network counter at
 * one, and the limit never fires. Neither axis is a nice-to-have version of the
 * other; they stop different attacks.
 *
 * Counted in Postgres for the reason the enquiry limiter is: a module-level
 * `Map` counts per process, so two instances silently double the real limit and
 * every deploy resets it to zero.
 *
 * **A separate table from `enquiry_throttle`, and a separate module.** They
 * share a shape and about six lines, and they must not share a row: the public
 * storefront's role writes the enquiry counter — the contact form is
 * unauthenticated, that is where counting happens — and a role that can write
 * this table can reset it, turning a rate-limited login into an unlimited one.
 * One table cannot hold both grants (`db/migrations/0006_editor_role.sql`).
 */

/**
 * Five per account and twenty per network, over a quarter of an hour.
 *
 * **The network limit is deliberately the looser one**, which looks backwards
 * until you remember who is behind it: the agency's three people sit in one
 * office behind one address. A network limit as tight as the account limit
 * would mean Sofia mistyping her password twice locks out both her colleagues —
 * a self-inflicted outage of the back-office, caused by the control meant to
 * protect it.
 *
 * Five per account is tight, and affordable here precisely because it is small:
 * three people, and a forgotten password is already an SSH call to the owner
 * rather than a self-service reset. A quarter of an hour is short enough that
 * somebody genuinely locked out waits rather than telephones.
 */
const PER_ACCOUNT = 5;
const PER_NETWORK = 20;
const WINDOW_MINUTES = 15;

export type LoginAxis = "account" | "network";

/**
 * A key that identifies one bucket and cannot be turned back into who it was.
 *
 * Both inputs are personal data — an email address obviously, an IP address
 * under GDPR — and a table recording failed sign-ins keyed on a raw email would
 * be a list of which addresses have accounts here, readable by anyone who ever
 * sees a backup. It is the enumeration this file exists to prevent, written
 * down.
 *
 * The address is truncated before hashing; the email is lowercased, so that
 * `Sofia@` and `sofia@` share one counter rather than doubling the allowance.
 *
 * HMAC when `THROTTLE_SECRET` is set, a plain hash when it is not. Unset it
 * degrades rather than refuses: a limiter that fails open would be worse than
 * one that is merely less private, and `env.ts` says production must set it.
 */
function keyFor(axis: LoginAxis, identifier: string): string {
  const subject =
    axis === "network"
      ? `login:network:${networkOf(identifier)}`
      : `login:account:${identifier.trim().toLowerCase()}`;

  const secret = env.THROTTLE_SECRET;
  return secret
    ? createHmac("sha256", secret).update(subject).digest("hex")
    : createHash("sha256").update(subject).digest("hex");
}

/**
 * Count this attempt on one axis and say whether it is still allowed.
 *
 * One statement. Read-then-write would let two requests arriving together both
 * read four and both write five — the classic way a limiter is bypassed by
 * exactly the traffic it exists to stop.
 *
 * It **fails closed**: an unreachable database throws out of here, and the
 * caller refuses the sign-in. Signing somebody in while the limiter is blind
 * would be the wrong way round, and the session could not be written anyway.
 */
export async function consumeLoginAllowance(
  axis: LoginAxis,
  identifier: string,
): Promise<{ allowed: boolean }> {
  const limit = axis === "account" ? PER_ACCOUNT : PER_NETWORK;

  const rows = await editorQuery<{ count: number }>(
    `insert into admin_login_throttle (key_hash, window_start, count)
     values ($1, now(), 1)
     on conflict (key_hash) do update set
       -- A window older than the interval starts again; otherwise this counts on.
       window_start = case
         when admin_login_throttle.window_start < now() - ($2 || ' minutes')::interval
           then now() else admin_login_throttle.window_start end,
       count = case
         when admin_login_throttle.window_start < now() - ($2 || ' minutes')::interval
           then 1 else admin_login_throttle.count + 1 end
     returning count`,
    [keyFor(axis, identifier), String(WINDOW_MINUTES)],
  );

  return { allowed: (rows[0]?.count ?? limit + 1) <= limit };
}

/**
 * Forget the failures for one account after a successful sign-in.
 *
 * Without this, five typos followed by the right password still leaves the
 * account locked for the rest of the window — punishing the person who got in.
 * The network counter is deliberately **not** cleared: one successful sign-in
 * from an office address must not wipe the evidence of somebody else grinding
 * away behind the same one.
 */
export async function clearLoginAllowance(email: string): Promise<void> {
  // Zeroed rather than deleted, so this needs no privilege the counting above
  // does not already have (`0006_editor_role.sql`). The row is spent either
  // way; leaving it costs one row per account and saves a grant.
  await editorQuery("update admin_login_throttle set count = 0 where key_hash = $1", [
    keyFor("account", email),
  ]);
}
