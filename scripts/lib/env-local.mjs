/**
 * Load `.env.local` into `process.env`, for the scripts that talk to Postgres.
 *
 * **Why this exists.** Next reads `.env.local` on its own, so the application
 * has always had `DATABASE_URL` without anybody exporting anything. The scripts
 * beside it did not: `migrate`, `seed` and `admin-user` read `process.env` and
 * nothing else, so `HANDOFF.md` has to tell every new machine to export the
 * variables by hand, and `pnpm verify:db` fails with "DATABASE_URL is not set"
 * on a machine where the site itself runs perfectly.
 *
 * That gap is not only inconvenient, it has produced real defects. The e2e
 * config decided whether it was allowed to touch a database by reading a
 * variable the server did not get from the same place, so it judged "no
 * database" while the server connected to one — and `e2e/global-setup.ts`,
 * reading the same absence, stopped clearing the rate limiters. Two components
 * disagreeing about which database is in play is the shape of the bug; the fix
 * is for everything to resolve it the same way.
 *
 * **Precedence matches Next's:** an exported variable wins over the file, so
 * `DATABASE_URL=…/belso_test pnpm db:seed` still overrides, and a deployment
 * that sets real values is unaffected by a stray file.
 *
 * Imported for its side effect — `import "./lib/env-local.mjs"` — before
 * anything reads `process.env`.
 *
 * Deliberately duplicated by `playwright.config.ts`, which parses the same file
 * with its own copy. That config is TypeScript and is type-checked; importing
 * an untyped `.mjs` from it would mean either `allowJs` across the project or a
 * declaration file for fifteen lines. The repository already prefers a
 * documented duplication to bad coupling in `lib/network.ts`, for the same kind
 * of reason. If this parser changes, change that one.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let text;
try {
  text = readFileSync(join(root, ".env.local"), "utf8");
} catch {
  // No file is the ordinary case on a fresh clone, in CI, and in production.
  text = "";
}

for (const line of text.split(/\r?\n/)) {
  const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (!match) continue;

  const [, key, raw] = match;
  if (process.env[key]) continue;

  // Strip one matching pair of surrounding quotes, as dotenv-style files allow.
  const value = (raw ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
  if (value) process.env[key] = value;
}
