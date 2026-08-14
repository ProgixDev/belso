#!/usr/bin/env node
/**
 * Render a feature report (docs/reports/<slug>.md) to PDF for sharing outside the repo.
 * Usage: pnpm report:pdf <slug>
 * Uses marked (md → html) + Playwright's Chromium (html → pdf) — no extra toolchain.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: pnpm report:pdf <report-slug>  (e.g. pnpm report:pdf 002-search)");
  process.exit(1);
}

const mdPath = resolve(`docs/reports/${slug}.md`);
if (!existsSync(mdPath)) {
  console.error(`No report at ${mdPath} — run /feature-report first.`);
  process.exit(1);
}

const body = marked.parse(readFileSync(mdPath, "utf8"));
const baseHref = pathToFileURL(resolve("docs/reports") + "/").href;
const html = `<!doctype html>
<html><head><meta charset="utf-8"><base href="${baseHref}"><style>
  body { font: 14px/1.6 -apple-system, "Segoe UI", sans-serif; color: #18181b; max-width: 760px; margin: 40px auto; padding: 0 24px; }
  h1, h2, h3 { line-height: 1.25; } h1 { font-size: 26px; } h2 { margin-top: 2em; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #d4d4d8; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #fafafa; }
  code { font-family: ui-monospace, monospace; font-size: 12px; background: #f4f4f5; padding: 1px 4px; border-radius: 4px; }
  pre { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; overflow-x: auto; }
  img { max-width: 100%; border: 1px solid #e4e4e7; border-radius: 8px; margin: 8px 0; }
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
// <base href> points at docs/reports/ so relative image paths (<slug>/img/...) resolve.
await page.setContent(html, { waitUntil: "networkidle" });
const pdfPath = resolve(`docs/reports/${slug}.pdf`);
await page.pdf({
  path: pdfPath,
  format: "A4",
  margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
  printBackground: true,
});
await browser.close();
console.log(`PDF written to ${pdfPath}`);
