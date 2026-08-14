#!/usr/bin/env node
/**
 * check-web-readiness — a pre-launch gate for web production-readiness (the web
 * equivalent of mobile store-readiness). Verifies the SEO / PWA / error surfaces
 * exist and that placeholder identity has been replaced. Rule IDs → docs/web/checklist.md.
 *
 * NOT part of `pnpm verify` (the bare skeleton legitimately ships placeholder
 * identity). Run before launch: `pnpm web:check`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const findings = [];
const add = (sev, id, msg) => findings.push({ sev, id, msg });
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null);

// 1) Required production surfaces (WEB-SEO / WEB-PWA / WEB-ERROR).
const REQUIRED = [
  ["src/app/robots.ts", "P1", "WEB-SEO-ROBOTS", "robots.ts (crawl rules + sitemap)"],
  ["src/app/sitemap.ts", "P1", "WEB-SEO-SITEMAP", "sitemap.ts"],
  ["src/app/manifest.ts", "P2", "WEB-PWA-MANIFEST", "manifest.ts (PWA)"],
  ["src/app/not-found.tsx", "P1", "WEB-ERROR-404", "not-found.tsx (404 page)"],
  ["src/app/global-error.tsx", "P1", "WEB-ERROR-500", "global-error.tsx (root error boundary)"],
];
for (const [path, sev, id, label] of REQUIRED) {
  if (!existsSync(join(ROOT, path))) add(sev, id, `missing ${label} (${path})`);
}

// 2) Metadata base + OG (WEB-SEO-META).
const layout = read("src/app/layout.tsx") ?? "";
if (!/metadataBase/.test(layout)) add("P1", "WEB-SEO-META", "layout.tsx has no metadataBase (breaks canonical + OG URLs)");
if (!/openGraph/.test(layout)) add("P2", "WEB-SEO-OG", "layout.tsx has no Open Graph metadata");

// 3) Identity not still placeholder (WEB-IDENTITY).
const siteCfg = read("src/core/site.ts") ?? "";
if (/Next\.js Skeleton/.test(siteCfg)) add("P1", "WEB-IDENTITY", "src/core/site.ts still uses the placeholder name 'Next.js Skeleton' — brand the app");
if (!/NEXT_PUBLIC_SITE_URL/.test(read(".env.example") ?? "")) add("P3", "WEB-IDENTITY", "set NEXT_PUBLIC_SITE_URL (drives canonical + OG)");

const p1 = findings.filter((f) => f.sev === "P1");
if (findings.length === 0) {
  console.log("check-web-readiness ✓ no automated web-readiness blockers");
  console.log("Manual gate: docs/web/checklist.md (analytics consent, Core Web Vitals, a11y, real OG image).");
  process.exit(0);
}
console.error(`\ncheck-web-readiness found ${findings.length} item(s) (${p1.length} P1):\n`);
for (const f of findings) console.error(`  ${f.sev === "P1" ? "✗" : "•"} [${f.sev}] ${f.id} — ${f.msg}`);
console.error("\nP1 = fix before launch. Full catalog: docs/web/checklist.md\n");
process.exit(p1.length > 0 ? 1 : 0);
