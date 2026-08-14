#!/usr/bin/env node
/**
 * check-secrets — a dependency-free guard against the #1 AI-coding failure mode:
 * secrets leaking into the client bundle / repo. Runs in `pnpm verify` and
 * pre-commit. Two project-specific rules:
 *
 *   1. ENV NAMING — a NEXT_PUBLIC_* var whose name looks like a secret. Anything
 *      prefixed NEXT_PUBLIC_ is inlined into the client bundle, so a name like
 *      NEXT_PUBLIC_SERVICE_ROLE_KEY means a real secret is shipping public.
 *   2. HARDCODED SECRETS — secret-shaped literals (service_role JWTs, Stripe
 *      `sk_…`, Supabase `sb_secret_…`) in source/config, and in the built client
 *      bundle (`.next/static`) when present.
 *
 * See docs/security/checklist.md (SEC-SECRET-*).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const ROOT = process.cwd();
const problems = [];

const SECRET_ENV_NAME =
  /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*/g;

const SECRET_VALUE = [
  { re: /\bsk_(live|test)_[A-Za-z0-9]{8,}\b/g, what: "Stripe secret key" },
  { re: /\bsb_secret_[A-Za-z0-9_-]{8,}\b/g, what: "Supabase secret key" },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/g, what: "JWT literal" },
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "docs",
  ".husky",
  "e2e",
]);
// Files that legitimately contain the patterns (detectors / env guard / tests).
const IGNORE_FILES = new Set(["check-secrets.mjs", "logger.ts", "env.ts", "env.client.ts"]);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (IGNORE_DIRS.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(full)) && !IGNORE_FILES.has(basename(full))) out.push(full);
  }
  return out;
}

function scanEnvNames(files) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*(#|\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(SECRET_ENV_NAME)) {
          problems.push(
            `${file}:${i + 1}  secret-looking public env var "${m[0]}" — NEXT_PUBLIC_* is inlined into the client bundle. Keep it server-side (read via src/core/env.ts).`,
          );
        }
      });
  }
}

function scanValues(files, label) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/eslint-disable.*no-secrets|check-secrets:allow/.test(line)) return;
        for (const { re, what } of SECRET_VALUE) {
          if (re.test(line)) {
            problems.push(
              `${file}:${i + 1}  hardcoded ${what} in ${label} — secrets must never live in source or the client bundle.`,
            );
          }
          re.lastIndex = 0;
        }
      });
  }
}

// 1. Env naming — config + env files + source.
scanEnvNames([
  ...[".env", ".env.example", ".env.local", ".env.development", ".env.production"].map((f) =>
    join(ROOT, f),
  ),
  ...walk(join(ROOT, "src"), [".ts", ".tsx"]),
]);

// 2. Hardcoded secrets — source.
scanValues(walk(join(ROOT, "src"), [".ts", ".tsx"]), "source");

// 3. Build-time guard — scan the built CLIENT bundle if present.
const clientDir = join(ROOT, ".next", "static");
if (existsSync(clientDir)) {
  scanValues(walk(clientDir, [".js", ".json"]), "the client bundle (.next/static)");
}

if (problems.length > 0) {
  console.error(`\ncheck-secrets found ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("\nSecrets never belong in NEXT_PUBLIC_* vars, source, or the client bundle.");
  console.error("See docs/security/checklist.md (SEC-SECRET-*).\n");
  process.exit(1);
}

console.log("check-secrets ✓ no exposed secrets or secret-looking public env vars");
