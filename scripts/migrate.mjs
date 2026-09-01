#!/usr/bin/env node
/**
 * Apply pending migrations from `db/migrations`, in order, exactly once.
 *
 * Deliberately small. ADR-0008 dropped Supabase and its CLI with it, and six
 * read functions plus one insert do not justify adopting a migration framework
 * to replace it. What a framework would give us that matters here is: run in
 * order, run once, and stop at the first failure. That is this file.
 *
 * Two properties worth stating because they are the ones that bite:
 *
 * - **Each migration runs inside a transaction** together with the row that
 *   records it. A migration cannot half-apply and then be marked done, and it
 *   cannot apply and fail to be recorded — the pair commit or neither does.
 * - **Applied files are checksummed.** Editing a migration that has already run
 *   is silent corruption: the file says one thing, the database is another. It
 *   is refused, loudly, rather than skipped quietly.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvLocal } from "./lib/env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "db", "migrations");

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("migrate: DATABASE_URL is not set.");
  console.error("  Local development reaches the VPS database over an SSH tunnel:");
  console.error("    ssh -N -L 5432:belso-db-db-1:5432 belso-vps");
  process.exit(1);
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name        text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    )
  `);

  const { rows } = await client.query("select name, checksum from schema_migrations");
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));

  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let ran = 0;

  for (const name of files) {
    const sql = readFileSync(join(dir, name), "utf8");
    const checksum = sha(sql);
    const previous = applied.get(name);

    if (previous) {
      if (previous !== checksum) {
        throw new Error(
          `${name} has changed since it was applied (${previous} → ${checksum}).\n` +
            "  An applied migration is history and must not be edited — the database no longer\n" +
            "  matches the file. Write a new migration that makes the change instead.",
        );
      }
      continue;
    }

    // The runner owns the transaction, and the files deliberately do not open
    // their own: a `commit` inside the file would close this one, and the
    // bookkeeping insert below would then land outside it — applied but
    // unrecorded, which re-runs on the next deploy.
    //
    // Recording the row in the same transaction is what makes "applied" and
    // "recorded" a single fact rather than two that can disagree.
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [
        name,
        checksum,
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${name} failed and was rolled back: ${error.message}`);
    }

    console.log(`  applied ${name}`);
    ran += 1;
  }

  console.log(
    ran === 0
      ? `migrate ✓ nothing to do (${files.length} already applied)`
      : `migrate ✓ ${ran} applied, ${files.length} total`,
  );
} catch (error) {
  console.error(`migrate ✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
