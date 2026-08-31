import "server-only";
import { createHash, createHmac } from "node:crypto";
import { query } from "@/core/db";
import { env } from "@/core/env";
import { networkOf } from "@/lib/network";

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
 * **The key is an HMAC of a truncated network, never the address.** What
 * identifies a sender is their IP, which is itself personal data under GDPR —
 * and this table exists to protect a table of personal data, not to become a
 * second one. See `keyFor` for why the first version did not achieve that.
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
 * A stable key for one sender that cannot be turned back into an address.
 *
 * The first version was a bare `sha256(ip)` and the comment called it
 * non-reversible. **It was not.** The whole IPv4 space is 2^32 hashes — minutes
 * of work — so anyone holding a nightly dump, which sits on the same disk as
 * the database, could recover which address enquired about which listing. That
 * is precisely the personal data this table exists to avoid holding.
 *
 * Two changes fix it. The address is **truncated first** — to a /24 for IPv4
 * and a /64 for IPv6 — which is both privacy-preserving and better limiting:
 * a residential IPv6 client rotates freely within its own /64, so counting the
 * full address gave one attacker unlimited fresh buckets. And it is an **HMAC**
 * under a server-side secret, so the preimage space cannot be enumerated at all
 * without the key.
 *
 * The secret is optional. Unset, this degrades to the old hash rather than
 * refusing to throttle — a limiter that fails open is worse than one that is
 * merely less private — and `env.ts` documents that production should set it.
 *
 * `networkOf` moved to `lib/` when the back-office sign-in became its second
 * consumer. The limiters themselves stay apart — different tables, different
 * grants — but truncating an address is arithmetic and belongs in one place.
 */
function keyFor(identifier: string, kind: string): string {
  const subject = `${kind}:${networkOf(identifier)}`;
  const secret = env.THROTTLE_SECRET;
  return secret
    ? createHmac("sha256", secret).update(subject).digest("hex")
    : createHash("sha256").update(subject).digest("hex");
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
  kind: "attempt" | "store",
): Promise<ThrottleDecision> {
  const limit = kind === "attempt" ? ATTEMPTED : STORED;
  // Keyed on the sender and the kind, and on nothing the sender supplies.
  // Salting this with the listing reference — which arrives from the form —
  // let a script mint a fresh counter per submission, so the limit never fired.
  const key = keyFor(identifier, kind);

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
