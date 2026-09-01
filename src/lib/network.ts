/**
 * Reduce an IP address to the network it belongs to.
 *
 * Two consumers, both rate limiters — the public enquiry form and the
 * back-office sign-in — and they share this and nothing else. The limiters
 * themselves stay separate: they count into different tables with deliberately
 * different grants (`belso_app` must write the enquiry counter and must never
 * touch the login one), and a shared helper parameterised by table name would
 * mean interpolating that name into SQL. Six duplicated lines of upsert beat
 * that. This function has no such problem: it is arithmetic on a string.
 *
 * **Truncating is both a privacy measure and better limiting.** An IP address
 * is personal data, and a counter table keyed on one becomes a second table of
 * personal data protecting the first. It also fixes a real hole: a residential
 * IPv6 client is handed a whole /64 and rotates freely inside it, so counting
 * full addresses gave one attacker an unlimited supply of fresh buckets.
 */

export function networkOf(identifier: string): string {
  if (identifier.includes(":")) {
    // IPv6: the first four groups are the /64 a single subscriber is given.
    return identifier.split(":").slice(0, 4).join(":");
  }

  const octets = identifier.split(".");
  return octets.length === 4 ? octets.slice(0, 3).join(".") : identifier;
}

/**
 * The client address to count against, from the forwarding headers.
 *
 * **The last hop, not the first, and that is the whole point.** The obvious
 * reading of `X-Forwarded-For` is "the first entry is the client" — which is
 * true only if the proxy in front sanitises what the client sent. Ours does:
 * Traefik trusts no forwarded headers unless `forwardedHeaders.trustedIPs`
 * names someone, and nothing does. But the limiter should not be correct only
 * because of a setting in a file this repository does not own, that nobody here
 * would notice changing, and that a future move to another proxy would silently
 * take with it.
 *
 * The last entry is the address the *nearest* proxy observed, so it is right
 * under both behaviours: if Traefik replaced a forged header, the list is just
 * the real client; if it had appended to one, the forged values sit in front of
 * the real one and are ignored. A forger can lengthen the list and cannot reach
 * the end of it.
 *
 * This holds because there is exactly one proxy. Put a CDN in front and the
 * last hop becomes the CDN — at which point this needs a hop count, and the
 * comment that says so is cheaper than the incident.
 */
export function clientAddress(forwardedFor: string | null, realIp: string | null): string {
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  const last = hops[hops.length - 1];
  if (last) return last;

  // `||`, not `??`: a header present but blank is not a value, and `??` would
  // hand back the empty string as though it were an address — a bucket keyed on
  // nothing, which is neither the real client nor the shared fallback.
  return realIp?.trim() || "unknown";
}
