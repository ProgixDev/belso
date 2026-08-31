import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { editorQuery, isEditorConfigured } from "./db";
import { env } from "./env";
import { ADMIN_SESSION_COOKIE, ADMIN_SIGN_IN_PATH } from "./session-cookie";

/**
 * Who is signed in to the back-office, and how that is decided.
 *
 * In `core`, not in `features/admin`, for a reason that is structural rather
 * than tidy: `features/properties` has to authorise its own publish action and
 * `features/enquiries` will have to authorise marking a lead handled, and
 * **features may never import features** (`module-boundaries.md`). The
 * precedent is `core/i18n.ts`, which lives here because `proxy.ts` needs it and
 * cannot reach up into a slice. Same argument, one layer along.
 *
 * ADR-0011 records why this is a table and forty lines rather than an auth
 * library.
 *
 * **What this module is not:** it is not the gate. It answers "who is this",
 * and the answer is `null` far more often than anything is wrong. Refusing is
 * the caller's job — `requireSession()` for the ordinary case — because a
 * Server Action is an independently addressable endpoint and each one has to
 * refuse for itself.
 */

/** The signed-in person, as every admin screen and action needs them. */
export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
};

export { ADMIN_SIGN_IN_PATH };

/**
 * Seven days, absolute — not extended by use.
 *
 * Long enough that she is not signing in every morning, short enough that a
 * session forgotten on the agency's shared desktop dies by itself. A sliding
 * window would mean the opposite: the sessions that live longest are the ones
 * on machines somebody keeps using, which is exactly backwards.
 */
const LIFETIME_SECONDS = 7 * 24 * 60 * 60;

/**
 * How stale `last_seen_at` may get before it is written again.
 *
 * Without this, reading the session — which every admin page does — is also a
 * write, so browsing the back-office writes a row per navigation forever. The
 * column exists to tell a live session from an abandoned one, and five minutes
 * is far finer than that question needs.
 */
const TOUCH_INTERVAL = "5 minutes";

/**
 * The cookie carries the token; the database stores only this.
 *
 * A plain SHA-256, no salt and no stretching — indefensible for a password and
 * correct here. The input is 32 bytes from the system CSPRNG, so there is no
 * dictionary to run and no guess cheaper than exhausting the keyspace. What it
 * buys is that a database dump — a backup on a laptop, a `pg_dump` pasted into
 * a support thread — is not a stack of live cookies.
 */
function digest(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

type SessionRow = {
  id: string;
  email: string;
  display_name: string;
};

/**
 * Start a session for `userId` and set the cookie.
 *
 * Callable only from a Server Action or Route Handler — Next forbids writing
 * cookies during a render, which is the right restriction and not one worth
 * working around.
 */
export async function createSession(userId: string): Promise<void> {
  // base64url so the value needs no escaping in a cookie. Still 32 bytes of
  // entropy; the encoding does not add or remove any.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_SECONDS * 1000);

  await editorQuery(
    `insert into admin_sessions (token_sha256, user_id, expires_at)
     values ($1, $2, $3)`,
    [digest(token), userId, expiresAt],
  );

  /*
   * Sweep on sign-in rather than on a schedule. Three users produce a handful
   * of rows a week, so there is nothing here worth a cron entry — and a cleanup
   * that runs when somebody signs in is a cleanup that cannot silently stop
   * running without anybody signing in either.
   */
  await editorQuery("delete from admin_sessions where expires_at < now()");

  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    // Not sent on a cross-site POST, which is most of what CSRF is — the rest
    // is Next's own Origin check on Server Actions.
    sameSite: "lax",
    // Off over plain http so this works on localhost. Every real deployment is
    // behind Traefik with TLS, where it is on.
    //
    // Through `env`, not `process.env`: SEC-ENV-001 makes `env.ts` the only
    // reader, and the rule is worth more than the one case where reading the
    // raw value would obviously have been harmless.
    secure: env.NODE_ENV === "production",
    // Scoped, so the public storefront never carries the session — not in a
    // request, not in a proxy log, not in a cache key.
    path: "/admin",
    maxAge: LIFETIME_SECONDS,
  });
}

/**
 * The signed-in person, or `null`.
 *
 * Memoised per request with React's `cache`, not module-level: the admin layout
 * asks, and then so does every action and page under it, and without this each
 * one is its own round trip. A module-level cache would instead hand one
 * person's session to the next request, which is the bug the Zustand rule in
 * `AGENTS.md` exists to prevent, one layer down.
 *
 * **A stale cookie is ignored, not cleared.** Clearing it would mean writing a
 * cookie during a render, which Next does not allow. The effect is only that a
 * signed-out browser is bounced to the sign-in page once more than strictly
 * necessary, and signing in overwrites the cookie anyway.
 */
export const currentSession = cache(async (): Promise<AdminSession | null> => {
  // No editor connection means no back-office, and the sign-in page says so.
  // Throwing here would turn a missing variable into a 500 on every admin URL.
  if (!isEditorConfigured()) return null;

  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  /*
   * One statement, and the data-modifying CTE is why: the touch and the lookup
   * would otherwise be two round trips on every admin request, for a column
   * nothing reads in a hurry. Both halves see the same snapshot, so the row
   * returned is the row as it stood before its own `last_seen_at` moved.
   *
   * The three conditions in the `select` are the entire authorisation decision:
   * the token matches, the session has not expired, and the account is not
   * disabled. Disabling somebody takes effect on their very next request
   * because it is checked here rather than baked into a token — the property
   * ADR-0011 chose a session table to get.
   */
  const rows = await editorQuery<SessionRow>(
    `with touched as (
       update admin_sessions set last_seen_at = now()
        where token_sha256 = $1
          and expires_at > now()
          and last_seen_at < now() - $2::interval
       returning token_sha256
     )
     select u.id, u.email, u.display_name
       from admin_sessions s
       join admin_users u on u.id = s.user_id
      where s.token_sha256 = $1
        and s.expires_at > now()
        and u.disabled_at is null`,
    [digest(token), TOUCH_INTERVAL],
  );

  const row = rows[0];
  if (!row) return null;

  return { userId: row.id, email: row.email, displayName: row.display_name };
});

/**
 * The session, or a redirect to sign in. The first line of every admin action.
 *
 * It throws — `redirect()` does, by design — so there is no way to call this
 * and carry on regardless, which is the property that makes "did you remember
 * to check" a question `grep` can answer.
 *
 * No `?next=` here: an action has no path to return to, and the proxy attaches
 * one for navigations, where it means something.
 */
export async function requireSession(): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) redirect(ADMIN_SIGN_IN_PATH);
  return session;
}

/** Sign out: destroy the row, then the cookie. Server Actions only. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    // The row goes first. Were the cookie cleared first and this then failed,
    // the session would stay valid for anyone holding the token she believed
    // she had just discarded.
    await editorQuery("delete from admin_sessions where token_sha256 = $1", [digest(token)]);
  }

  store.delete(ADMIN_SESSION_COOKIE);
}
