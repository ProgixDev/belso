#!/usr/bin/env node
/**
 * Docs integrity gate: every relative markdown link in the knowledge tree must
 * resolve to a real file. Dead links silently break agent grounding — an agent
 * told to "see docs/x.md" that doesn't exist will improvise instead (badly).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// `HANDOFF.md` is included for the reason the rest are: it is written to be read
// by an agent with no memory of the session that produced it, so a dead link in
// it is a dead link at exactly the moment nobody can work around one.
const TARGETS = ["docs", "specs", ".claude", "AGENTS.md", "CLAUDE.md", "README.md", "HANDOFF.md"];
const violations = [];

function collect(path, out) {
  if (!existsSync(path)) return;
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === "node_modules" || entry.startsWith(".git")) continue;
      collect(join(path, entry), out);
    }
  } else if (path.endsWith(".md")) {
    out.push(path);
  }
}

const files = [];
for (const target of TARGETS) collect(target, files);

for (const file of files) {
  const content = readFileSync(file, "utf8");
  // Skip fenced code blocks — links there are examples, not navigation.
  const withoutCode = content.replace(/```[\s\S]*?```/g, "");
  for (const match of withoutCode.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const raw = match[1];
    if (!raw) continue;
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const targetPath = resolve(dirname(file), raw.split("#")[0] ?? "");
    if (!existsSync(targetPath)) {
      violations.push(`${file}: dead link → ${raw}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Docs check failed — dead links found:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Docs check passed (${files.length} markdown files scanned).`);
