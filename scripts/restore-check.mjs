#!/usr/bin/env node
/**
 * Prove the backups can be restored — by restoring one (spec 010, AC-6).
 *
 * A backup nobody has ever restored is a belief, not a backup. This takes the
 * newest dump the nightly job wrote, restores it into a scratch database beside
 * the real one, and then does the thing that makes it evidence rather than
 * ceremony: **runs the site's own golden snapshot against the restored copy.**
 *
 * That last step is why this exists in the shape it does. Comparing row counts
 * proves rows arrived. Running `repository.golden.test.ts` against the restored
 * database proves the *site* would serve the same catalogue from it — the same
 * 113 queries, the same twenty listings, the same order. Anything less is
 * checking that a file is large.
 *
 * Runs the restore on the VPS over SSH, because `pg_restore` lives inside the
 * Postgres container and the VPS has no Node. It needs the `belso-vps` SSH
 * alias (docs/security/vps.md) and an open tunnel (`pnpm db:tunnel`).
 *
 * The scratch database is dropped at the end, including on failure.
 */
import { execFileSync } from "node:child_process";

const HOST = process.env.BELSO_VPS ?? "belso-vps";
const CONTAINER = "belso-db-db-1";
const SCRATCH = "belso_restore_check";
const TUNNEL_PORT = process.env.BELSO_TUNNEL_PORT ?? "55432";

const ssh = (script) =>
  execFileSync("ssh", [HOST, "bash", "-s"], { input: script, encoding: "utf8" }).trim();

const psql = (db, sql) =>
  ssh(`docker exec ${CONTAINER} psql -U belso -d ${db} -tAc ${JSON.stringify(sql)}`);

/**
 * Every table the live database has — asked, not assumed.
 *
 * This was a hardcoded list of seven, and it omitted `property_slug_history`
 * (the table AC-7 depends on), `enquiry_throttle` and `schema_migrations`. A
 * dump that lost any of them restored, compared clean, and printed ✓. A backup
 * check that only looks at the tables someone remembered is a backup check that
 * will miss the table someone forgot — which is the same table the migration
 * that added it also forgot to tell anyone about.
 */
function tablesOf(db) {
  // One line on purpose: this is quoted into `ssh … bash -s`, and a newline
  // inside the argument ends the command rather than continuing the query.
  return psql(
    db,
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function counts(db, tables) {
  const sql = tables.map((t) => `select '${t}', count(*) from ${t}`).join(" union all ");
  return Object.fromEntries(
    psql(db, sql)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [table, n] = line.split("|");
        return [table, Number(n)];
      }),
  );
}

let failed = false;

try {
  console.log("restore-check: taking a fresh dump first, so this tests tonight's path");
  console.log(ssh("/usr/local/bin/belso-backup.sh").replace(/^/gm, "  "));

  const dump = ssh(`ls -1t /root/backups/belso/belso-*.dump | head -1`);
  if (!dump) throw new Error("no dump found in /root/backups/belso");
  console.log(`restore-check: restoring ${dump.split("/").pop()}`);

  // Scratch database, dropped and recreated so a previous run cannot make this
  // one pass. `--clean --if-exists` inside pg_restore is not enough: it would
  // leave anything the dump does not mention.
  ssh(`
    set -e
    docker exec ${CONTAINER} psql -U belso -d postgres -c 'drop database if exists ${SCRATCH}' >/dev/null
    docker exec ${CONTAINER} psql -U belso -d postgres -c 'create database ${SCRATCH}' >/dev/null
    docker exec ${CONTAINER} pg_restore -U belso -d ${SCRATCH} --no-owner ${dump.replace("/root/backups/belso", "/backups")}
  `);

  const liveTables = tablesOf("belso");
  const restoredTables = tablesOf(SCRATCH);

  // The set first, then the contents. A table that vanished entirely is the
  // failure the old hardcoded list could not see.
  const missing = liveTables.filter((t) => !restoredTables.includes(t));
  if (missing.length) {
    throw new Error(`the restore is missing ${missing.length} table(s): ${missing.join(", ")}`);
  }

  const live = counts("belso", liveTables);
  const restored = counts(SCRATCH, liveTables);

  console.log("\n  table                     live   restored");
  let mismatch = false;
  for (const table of liveTables) {
    const ok = live[table] === restored[table];
    if (!ok) mismatch = true;
    console.log(
      `  ${table.padEnd(24)} ${String(live[table]).padStart(5)} ${String(restored[table]).padStart(10)}  ${ok ? "✓" : "✗"}`,
    );
  }
  if (mismatch) throw new Error("row counts differ between the live database and the restore");

  // The proof. Not "rows exist" — "the site serves the same catalogue".
  const password = ssh("grep POSTGRES_PASSWORD /docker/belso-db/.env | cut -d= -f2");
  const url = `postgres://belso:${password}@127.0.0.1:${TUNNEL_PORT}/${SCRATCH}`;

  console.log("\nrestore-check: running the golden snapshot against the restored database\n");
  /*
   * Vitest's own entry, run by this Node — not `npx`, and not `shell: true`.
   *
   * `shell: true` concatenates arguments instead of escaping them, and the
   * connection string being passed here carries a generated password. Windows
   * then refuses to spawn `npx.cmd` without a shell at all (EINVAL), so the
   * two obvious routes are one security warning and one hard failure. Calling
   * the module directly avoids both and is the same on every platform.
   */
  execFileSync(
    process.execPath,
    [
      new URL("../node_modules/vitest/vitest.mjs", import.meta.url).pathname.replace(
        /^\/(\w:)/,
        "$1",
      ),
      "run",
      "src/features/properties/repository.golden.test.ts",
    ],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
  );

  console.log(
    "\nrestore-check ✓ a backup was restored and the site's own oracle passed against it",
  );
} catch (error) {
  failed = true;
  console.error(`\nrestore-check ✗ ${error.message}`);
} finally {
  try {
    ssh(
      `docker exec ${CONTAINER} psql -U belso -d postgres -c 'drop database if exists ${SCRATCH}' >/dev/null`,
    );
  } catch {
    console.error(`restore-check: could not drop the scratch database ${SCRATCH} — do it by hand`);
  }
  if (failed) process.exitCode = 1;
}
