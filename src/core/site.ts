/**
 * Central site config — the single source for metadata, robots, sitemap, and
 * manifest. Replace name/description and set NEXT_PUBLIC_SITE_URL per app (it
 * drives canonical + Open Graph URLs).
 */

/**
 * The origin every canonical URL, Open Graph tag, `robots.txt` host and sitemap
 * entry is built from — so getting it wrong publishes `http://localhost:3000`
 * to crawlers.
 *
 * Three steps, in order of how much they can be trusted:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — the real domain, once one is bound. Set it.
 *   2. Vercel's own production domain, so a deploy made before step 1 still
 *      publishes something reachable. The `NEXT_PUBLIC_`-prefixed variant comes
 *      first because it is the only one of the two that survives into the
 *      browser bundle; a client component reading `site.url` would otherwise
 *      render a different origin than the server did.
 *   3. localhost, for `pnpm dev`.
 *
 * `||` rather than `??` throughout: a variable declared with an empty value is
 * not configured, and `??` would hand `""` to `new URL()` in the root layout,
 * which throws and fails the build.
 */
const vercelDomain =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

export const site = {
  name: "Belso Residences",
  shortName: "Belso",
  description: "Belso — a private residence of thirty homes in warm stone, water, and shade.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000"),
  locale: "en_US",
} as const;
