/**
 * Open-redirect guard. A `?next=`/`returnTo` style param is untrusted input —
 * redirecting to an attacker-controlled absolute URL is a classic phishing vector.
 * Only same-origin relative paths (or an explicitly allowlisted host) are allowed;
 * everything else falls back to a safe default. See docs/security/checklist.md (SEC-REDIR-001).
 */

/** Absolute hosts an external redirect may target (https only). Usually empty. */
const ALLOWED_HOSTS: readonly string[] = [];

export function safeRedirectPath(
  target: string | null | undefined,
  fallback = "/",
): string {
  if (!target) return fallback;
  try {
    // Same-origin relative path — but reject protocol-relative "//evil.com".
    if (target.startsWith("/") && !target.startsWith("//")) return target;

    const url = new URL(target);
    if (url.protocol === "https:" && ALLOWED_HOSTS.includes(url.hostname)) {
      return url.toString();
    }
    return fallback;
  } catch {
    // Not a parseable URL and not a clean relative path → unsafe.
    return fallback;
  }
}
