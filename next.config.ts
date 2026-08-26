import type { NextConfig } from "next";

/**
 * Security response headers. These are the cheapest, highest-leverage web
 * hardening — applied to every route. See docs/security/checklist.md (SEC-NET-*).
 *
 * CSP is shipped in **Report-Only** mode so it never breaks the app out of the
 * box; tighten it and switch to enforcing `Content-Security-Policy` per app
 * (add nonces/hashes for any inline scripts). The rest are safe to enforce.
 */
/**
 * The origins this deployment is actually configured to talk to.
 *
 * The map's style URL is a variable precisely so the provider can be swapped
 * without touching code (ADR-0009), which means the CSP cannot name a provider
 * either — it derives the origins from the same configuration the app uses.
 * Unparseable or unset values drop out rather than throwing the build.
 */
const configuredOrigins = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_MAP_STYLE_URL,
      process.env.NEXT_PUBLIC_MAP_SATELLITE_STYLE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      // The keyless default in `src/core/env.client.ts`; named here too, or a
      // deployment that never set the variable reports a violation per tile.
      "https://demotiles.maplibre.org",
    ].flatMap((value) => {
      if (!value?.trim()) return [];
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    }),
  ),
).join(" ");

const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (only meaningful over HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Clickjacking protection.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let browsers MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features by default; opt in per app as needed.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // A baseline CSP in report-only mode (won't block; surfaces violations to tune).
  // `connect-src` and `img-src` are narrowed from the `https:` wildcard to the
  // origins this deployment is configured for — the direction SEC-NET-002 asks
  // for, done while adding the one dependency that needed the header changed.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${configuredOrigins}`,
      "font-src 'self' data:",
      `connect-src 'self' ${configuredOrigins}`,
      /*
       * MapLibre runs a worker, and there was no `worker-src` here at all — the
       * fallback was `default-src 'self'`, so it would have been blocked the
       * moment this header stopped being report-only. `'self'` is enough and
       * `blob:` is not needed, because the worker is served from our own origin
       * rather than built from a blob (`scripts/sync-map-worker.mjs`).
       * `child-src` is the same rule for browsers that predate `worker-src`.
       */
      "worker-src 'self'",
      "child-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version.
  poweredByHeader: false,
  images: {
    /*
     * The hero scene plates are photoreal architectural renders shown full-bleed.
     * At the default quality of 75 the optimizer crushes the 1.1MB source PNG to a
     * 66KB WebP, which bands the sky gradient and smears the glass and foliage.
     * Next 16 only permits qualities declared here.
     */
    qualities: [75, 90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
