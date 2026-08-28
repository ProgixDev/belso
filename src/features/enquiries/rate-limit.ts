import "server-only";
import { createHash } from "node:crypto";
import { query } from "@/core/db";

/**
 * The throttle on the only door into this site that anyone can open.
 *
 * The enquiry form takes untrusted input, requires no account, and now writes
 * to a database. Without a limit, one script fills the `enquiries` table, the
 * disk it sits on, and the client's inbox — and the disk is shared with her
 * n8n and with Postgres itself, so "the enquiries table got large" and "the
 * site went down" are the same sentence here.
 *
 * **In Postgres rather than in memory**, which is the decision worth defending.
 * A module-level `Map` is simpler and is what most examples show, but it counts
 * per *process*: run two instances and the real limit is silently double, and
 * every deploy resets it to zero. A counter that lies about its own value is
 * worse than none, because it reads as protection.
 *
 * **The key is hashed and the raw value never stored.** What identifies a
 * sender is their IP address, which is itself personal data under GDPR — and
 * this table exists to protect a table of personal data, not to quietly become
 * a second one. The hash answers "have I seen this sender in the last hour"
 * without recording who they are.
 */

/**
 * Two limits, because they defend different things.
 *
 * `STORED` is what may reach the table: five enquiries an hour is generous for
 * a person and useless for a script.
 *
 * `ATTEMPTED` counts every submission, valid or not. Without it, validation
 * runs before the throttle and a malformed payload costs an attacker nothing —
 * they can hammer the action indefinitely for free. Counting attempts closes
 * that, and it is deliberately looser: someone mistyping their email three
 * times is a buyer, not an attack, and locking them out of the form over it
 * would cost the exact lead the form exists to capture.
 */
const STORED = 5;
const ATTEMPTED = 20;
const WINDOW_MINUTES = 60;

/**
 * A stable, non-reversible key for one sender.
 *
 * Salted with the form so an enquiry about a listing and one from the contact
 * page are counted separately — someone asking about three properties in an
 * afternoon is a good lead, not an attack.
 */
function keyFor(identifier: string, form: string): string {
  return createHash("sha256").update(`${form}:${identifier}`).digest("hex");
}

export type ThrottleDecision = { allowed: boolean };

/**
 * Count this attempt and say whether it is allowed.
 *
 * One statement, deliberately. Read-then-write would let two requests arriving
 * together both read four and both write five — the classic way a limiter is
 * bypassed by exactly the traffic it exists to stop. The upsert makes the read,
 * the window reset and the increment a single atomic operation, and returns the
 * resulting count so the decision is made on what was actually written.
 *
 * Fails **closed**: if the database cannot be reached, the enquiry is refused
 * rather than accepted unthrottled. The alternative — letting writes through
 * when the limiter is blind — is the failure mode worth avoiding, and the
 * enquiry cannot be stored in that state anyway.
 */
export async function consumeEnquiryAllowance(
  identifier: string,
  form: string,
  kind: "attempt" | "store" = "store",
): Promise<ThrottleDecision> {
  const limit = kind === "attempt" ? ATTEMPTED : STORED;
  // Salted with the kind as well as the form, so the two limits are two
  // independent counters rather than one that both callers decrement.
  const key = keyFor(identifier, `${kind}:${form}`);

  const rows = await query<{ count: number }>(
    `insert into enquiry_throttle (key_hash, window_start, count)
     values ($1, now(), 1)
     on conflict (key_hash) do update set
       -- A window older than the interval starts again; otherwise this counts on.
       window_start = case
         when enquiry_throttle.window_start < now() - ($2 || ' minutes')::interval
           then now() else enquiry_throttle.window_start end,
       count = case
         when enquiry_throttle.window_start < now() - ($2 || ' minutes')::interval
           then 1 else enquiry_throttle.count + 1 end
     returning count`,
    [key, String(WINDOW_MINUTES)],
  );

  return { allowed: (rows[0]?.count ?? limit + 1) <= limit };
}

/**
 * Drop counters whose window has long passed.
 *
 * Called by the nightly job. Without it this table grows by one row per sender
 * forever, which is a slow leak in the one place we cannot afford one.
 */
export async function pruneThrottleWindows(): Promise<number> {
  const rows = await query<{ id: string }>(
    `delete from enquiry_throttle
     where window_start < now() - interval '1 day'
     returning key_hash as id`,
  );
  return rows.length;
}
