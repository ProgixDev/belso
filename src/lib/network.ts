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
