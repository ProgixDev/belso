import type { MetadataRoute } from "next";
import { site } from "@/core/site";

/**
 * `/admin` is disallowed here as well as carrying `noindex` in its own layout.
 *
 * Not redundant: `noindex` is only read by a crawler that has already fetched
 * the page, and the back-office should not be fetched at all. Neither is a
 * security measure — this file is a public list of paths worth looking at — and
 * that is fine, because the gate is the layout and every action, not obscurity.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/api/"] },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
