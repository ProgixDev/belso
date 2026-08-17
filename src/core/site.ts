/**
 * Central site config — the single source for metadata, robots, sitemap, and
 * manifest. Replace name/description and set NEXT_PUBLIC_SITE_URL per app (it
 * drives canonical + Open Graph URLs).
 */
export const site = {
  name: "Belso Residences",
  shortName: "Belso",
  description: "Belso — a private residence of thirty homes in warm stone, water, and shade.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "en_US",
} as const;
