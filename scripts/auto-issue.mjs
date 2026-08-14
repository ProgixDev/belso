#!/usr/bin/env node
/**
 * Auto-file a GitHub issue for a serious problem the harness detected, so developers
 * never do this bookkeeping by hand (AGENTS.md obligations; ADR-0005).
 *
 * Usage:
 *   node scripts/auto-issue.mjs --title "..." --kind gate|security|cuj|other --body "..." [--dedupe-key "..."]
 *
 * Behavior:
 *   - Requires the `gh` CLI authenticated; if absent, prints the issue to stdout and exits 0
 *     (never breaks the pipeline that called it).
 *   - Labels the issue `auto-filed` + the kind, so the daily report and humans can spot them.
 *   - Dedupes: if an open issue with the same dedupe-key (in its body marker) exists, it
 *     comments instead of opening a duplicate.
 */
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const title = args.title ?? "Harness-detected problem";
const kind = args.kind ?? "other";
const dedupeKey = args["dedupe-key"] ?? title;
const marker = `<!-- auto-issue:${dedupeKey} -->`;
const body = `${marker}\n\n${args.body ?? "Filed automatically by the harness."}\n\n— auto-filed by \`scripts/auto-issue.mjs\` (${kind})`;

function gh(cmdArgs, opts = {}) {
  return execFileSync("gh", cmdArgs, { encoding: "utf8", ...opts });
}

try {
  gh(["auth", "status"], { stdio: "ignore" });
} catch {
  console.log("[auto-issue] gh not authenticated — issue NOT filed. Would have filed:\n");
  console.log(`Title: ${title}\nLabels: auto-filed, ${kind}\n\n${body}`);
  process.exit(0);
}

try {
  const existing = gh([
    "issue",
    "list",
    "--state",
    "open",
    "--label",
    "auto-filed",
    "--search",
    dedupeKey,
    "--json",
    "number,body",
    "--limit",
    "20",
  ]);
  const dup = JSON.parse(existing).find((i) => (i.body ?? "").includes(marker));
  if (dup) {
    gh([
      "issue",
      "comment",
      String(dup.number),
      "--body",
      "Still occurring as of this run. " + marker,
    ]);
    console.log(`[auto-issue] updated existing #${dup.number} (dedupe hit).`);
    process.exit(0);
  }
  // Ensure labels exist (ignore failures — they may already exist).
  for (const [label, color] of [
    ["auto-filed", "00aad4"],
    [kind, "0b1728"],
  ]) {
    try {
      gh(["label", "create", label, "--color", color, "--force"], { stdio: "ignore" });
    } catch {}
  }
  const url = gh([
    "issue",
    "create",
    "--title",
    title,
    "--label",
    `auto-filed,${kind}`,
    "--body",
    body,
  ]).trim();
  console.log(`[auto-issue] filed: ${url}`);
} catch (err) {
  // Never break the caller (a CI gate or a skill) because issue-filing failed.
  console.log(`[auto-issue] could not file (non-fatal): ${err.message}`);
  process.exit(0);
}
