import type { NextConfig } from "next";

/**
 * Security response headers. These are the cheapest, highest-leverage web
 * hardening — applied to every route. See docs/security/checklist.md (SEC-NET-*).
 *
 * CSP is shipped in **Report-Only** mode so it never breaks the app out of the
 * box; tighten it and switch to enforcing `Content-Security-Policy` per app
 * (add nonces/hashes for any inline scripts). The rest are safe to enforce.
 */
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
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
