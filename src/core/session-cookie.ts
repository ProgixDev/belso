/**
 * The two names `proxy.ts` and `session.ts` must agree on, and nothing else.
 *
 * **A separate module because of where `proxy.ts` runs.** The proxy is Edge, so
 * importing `session.ts` from it would drag `core/db.ts` and `pg` into a
 * runtime that cannot open a TCP socket — a build that succeeds and a site that
 * fails on its first request. This file imports nothing, so it is safe from
 * anywhere: Edge, Node, a test.
 *
 * Keeping them in one place is not tidiness. A cookie name spelled two ways is
 * a gate that silently never matches; a sign-in path spelled two ways is a
 * redirect loop. Both are the kind of bug that looks like an auth failure and
 * is a typo.
 */

/** The session cookie. Scoped to `/admin`, so the storefront never carries it. */
export const ADMIN_SESSION_COOKIE = "belso_session";

/** Everything under here is the back-office. */
export const ADMIN_PREFIX = "/admin";

/**
 * Where an unauthenticated request is sent. French, because the back-office is
 * French — the client and her two colleagues work in it, and nobody else will.
 */
export const ADMIN_SIGN_IN_PATH = `${ADMIN_PREFIX}/connexion`;

/**
 * Validate a `?next=` before anything redirects to it.
 *
 * The value arrives from the query string and from a hidden form field, which
 * is to say from whoever is asking. An unvalidated target is an open redirect:
 * a link to `belso.ma/admin/connexion?next=https://belso-ma.example/` signs
 * somebody in and then lands them on a convincing copy of the back-office on
 * somebody else's domain, with our address in the referrer to make it look
 * routine. Phishing, with our own URL as the bait.
 *
 * So the rule is an allow-list of one shape — a path under `/admin` — and
 * anything else falls back to the caller's default rather than being repaired.
 * Three things that look like paths and are not:
 *
 * - `//evil.com` is protocol-relative; a browser reads it as an absolute URL.
 * - `/admin\evil.com` — a backslash, which some parsers normalise to `/`.
 * - `/admin/../../etc` — traversal, meaningless here but not worth reasoning
 *   about again at every call site.
 *
 * Returns `null` for anything it will not vouch for, so the caller has to
 * decide what to do instead rather than being handed a value that looks safe.
 */
export function safeAdminPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.includes("\\") || next.includes("..")) return null;

  // Control characters, which can truncate a `Location` header or smuggle a
  // second one in after it. Written as a code-point test rather than a
  // character class so the source file contains no control characters itself.
  for (const character of next) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return null;
  }

  return new RegExp(`^${ADMIN_PREFIX}(/|$)`).test(next) ? next : null;
}
