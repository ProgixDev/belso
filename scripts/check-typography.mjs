#!/usr/bin/env node
/**
 * Typography gate (docs/conventions/copy.md): user-visible JSX text must use curly
 * quotes/apostrophes (“ ” ‘ ’) and the real ellipsis (…), never straight ' " or `...`.
 *
 * Scope (deliberately narrow to avoid false positives): JSX *text nodes* in
 * src/**.tsx — the text between > and < on a line. Code, attributes, and expressions
 * are not scanned. Escape hatch: a `typography-ok` comment on the same or previous
 * line skips that line (each use is reviewed).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path);
    else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx")) checkFile(path);
  }
}

function checkFile(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("typography-ok") || lines[i - 1]?.includes("typography-ok")) return;
    // JSX text nodes: content sitting between a `>` and a `<` on this line.
    for (const match of line.matchAll(/>([^<>{}]+)</g)) {
      const text = match[1];
      if (!text || !/[a-zA-Z]/.test(text)) continue; // skip non-prose
      if (/['"]/.test(text)) {
        violations.push(`${path}:${i + 1} straight quote in user-facing text: ${text.trim()}`);
      }
      if (/\.\.\./.test(text)) {
        violations.push(`${path}:${i + 1} use the … character, not "...": ${text.trim()}`);
      }
    }
  });
}

walk(ROOT);

if (violations.length > 0) {
  console.error("Typography check failed (docs/conventions/copy.md):\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nFix: use “curly quotes”, ’apostrophes’, and … — or add a typography-ok comment with a reason.",
  );
  process.exit(1);
}
console.log("Typography check passed.");
