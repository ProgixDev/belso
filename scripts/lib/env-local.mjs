/**
 * Load named variables from `.env.local` into `process.env`.
 *
 * **Why this exists.** Next reads `.env.local` on its own, so the application
 * has always had `DATABASE_URL` without anybody exporting anything. The scripts
 * beside it did not, so every new machine is told to export the variables by
 * hand and `pnpm verify:db` fails with "DATABASE_URL is not set" on a machine
 * where the site itself runs perfectly. Two components disagreeing about which
 * database is in play is the shape of the bug this closes — it is what made the
 * e2e scratch-database guard read "no database" while the server was connected
 * to one.
 *
 * **An allow-list, not everything in the file, and that is the security
 * property.** An earlier version lifted every `KEY=value` it found. That is
 * quietly dangerous here: `BELSO_ALLOW_PROD_TESTS=1` written into `.env.local`
 * would satisfy `vitest.db.setup.ts` permanently and invisibly, and
 * `BELSO_ALLOW_FIXTURES=1` would waive two production guards in `core/env.ts`.
 * Those variables exist to be a deliberate, per-run decision; a file is not a
 * decision. So this moves connection details, and nothing that turns a guard
 * off.
 *
 * **Precedence matches Next's:** an exported variable wins over the file, so
 * `DATABASE_URL=…/belso_test pnpm db:seed` still overrides, and a deployment
 * that sets real values is unaffected by a stray file. Within the file the last
 * assignment of a key wins, as dotenv-style loaders do.
 *
 * Called explicitly rather than run on import: the scripts that use it read
 * `process.env` at module scope, and an import-order dependency that an import
 * sorter could silently reorder is not a thing to rely on.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Connection details only. Never a variable that disables a guard. */
export const DATABASE_KEYS = ["DATABASE_URL", "DATABASE_EDITOR_URL", "MEDIA_ROOT"];

/**
 * Fill `keys` in `process.env` from `.env.local`. Returns the keys it filled,
 * so a caller can report where a value came from.
 *
 * Resolved relative to this module, not `process.cwd()`: a script run from a
 * subdirectory must not silently find no file and carry on as though the
 * repository had none.
 */
export function loadEnvLocal(keys = DATABASE_KEYS) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const wanted = new Set(keys);
  const filled = new Set();

  let text;
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return filled; // No file is the ordinary case on a fresh clone and in CI.
  }

  /** Last assignment wins, so scan the whole file before applying anything. */
  const found = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (!wanted.has(key)) continue;

    // Strip one matching pair of surrounding quotes, as dotenv-style files allow.
    const value = (raw ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value) found.set(key, value);
  }

  for (const [key, value] of found) {
    if (process.env[key]) continue; // An exported variable wins.
    process.env[key] = value;
    filled.add(key);
  }

  return filled;
}
