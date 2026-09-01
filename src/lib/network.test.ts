import { describe, expect, it } from "vitest";
import { clientAddress, networkOf } from "./network";

/**
 * The two functions both rate limiters depend on, neither of which had a test.
 *
 * `clientAddress` decides who is being counted, so getting it wrong does not
 * break anything visible — it quietly gives an attacker a fresh bucket per
 * request while the limiter reports itself working. That is the failure this
 * file exists to make loud.
 */

describe("clientAddress", () => {
  it("takes the last hop, not the first", () => {
    /*
     * The security property. A forged `X-Forwarded-For` arrives in front of
     * whatever the proxy appends, so reading the first entry reads the forgery.
     * Reading the last reads the address the nearest proxy actually observed —
     * a forger can lengthen the list and cannot reach the end of it.
     */
    expect(clientAddress("1.2.3.4, 203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("returns the only hop when the proxy replaced the header", () => {
    // Traefik's behaviour with no trustedIPs: it discards what the client sent.
    expect(clientAddress("203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("is not fooled by whitespace or empty entries", () => {
    expect(clientAddress(" 1.2.3.4 ,, 203.0.113.9 ,", null)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when there is no forwarded header", () => {
    expect(clientAddress(null, "203.0.113.9")).toBe("203.0.113.9");
  });

  it("collapses to one bucket when there is nothing to go on", () => {
    // Deliberately the strict direction: shared throttling is an inconvenience,
    // unthrottled is an open table.
    expect(clientAddress(null, null)).toBe("unknown");
    expect(clientAddress("", "  ")).toBe("unknown");
  });
});

describe("networkOf", () => {
  it("truncates IPv4 to its /24", () => {
    expect(networkOf("203.0.113.9")).toBe("203.0.113");
  });

  it("truncates IPv6 to the /64 a subscriber is given", () => {
    // The hole this closed: a residential IPv6 client rotates freely inside its
    // own /64, so counting full addresses handed one attacker an unlimited
    // supply of fresh buckets.
    expect(networkOf("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3:8d3");
    expect(networkOf("2001:db8:85a3:8d3:ffff:ffff:ffff:1")).toBe("2001:db8:85a3:8d3");
  });

  it("leaves anything it does not recognise alone", () => {
    // Including "unknown", which must stay one stable bucket rather than
    // becoming several.
    expect(networkOf("unknown")).toBe("unknown");
  });
});
