import "server-only";
import { Pool, type PoolClient } from "pg";
import { env } from "./env";

/**
 * The storefront's connection pool, as `belso_app` — a role that can read
 * published listings and insert an enquiry, and cannot write a listing
 * (`db/migrations/0004_app_role.sql`). The back-office's pool is separate and
 * lives further down this file (ADR-0010).
 *
 * This file is the only place the application opens either.
 *
 * Lives in `core` because every layer may reach down to it and it reaches
 * nothing — the bottom of the stack described in `module-boundaries.md`.
 *
 * **Module-level, unlike a Zustand store, and deliberately so.** The rule that
 * stores must be per-request factories exists because a store holds one
 * visitor's state and a module-level one would leak it between SSR requests. A
 * pool holds no request state at all: it is a set of TCP connections to a
 * process. One per Node process is the correct shape, and creating one per
 * request would exhaust Postgres's connection limit within a page load.
 *
 * Lazily constructed so that importing this module does not require a database.
 * The build renders pages, `pnpm verify` runs without one, and neither should
 * fail because a pool was opened at import time.
 */
let pool: Pool | undefined;

/** Raised instead of a connection when nothing is configured (spec 010, AC-5). */
export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The database is not reachable.");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

/**
 * Postgres answered, and said no — a duplicate slug, a failed constraint.
 *
 * **A subclass, not a sibling, and that is the entire design.** Every existing
 * caller catches `DatabaseUnavailableError` to decide between "no listings
 * matched" and "we cannot reach the database"; a sibling class would slip past
 * all of them and turn a duplicate slug into an unhandled exception on the
 * public catalogue. As a subclass, code that never learns this type keeps
 * behaving exactly as it did — `e2e/db-down.spec.ts` is the test that says so —
 * while the editor, which does care, narrows with `instanceof PostgresError`.
 *
 * That the message still reads as an outage is deliberate for the same reason:
 * anything shown to a visitor by the old path stays truthful, and the editor
 * never shows this message — it reads `code` and says "that address is already
 * taken".
 *
 * Some five-character SQLSTATEs *are* outages (`57P01` admin shutdown, `08006`
 * connection failure). Classifying them here is still correct, precisely
 * because this is a `DatabaseUnavailableError`: the outage path catches them
 * unchanged, and the editor's `switch` simply has no case for them.
 */
export class PostgresError extends DatabaseUnavailableError {
  /** The five-character SQLSTATE, e.g. `23505` for a unique violation. */
  readonly code: string;
  /** The constraint that rejected the row, when Postgres named one. */
  readonly constraint: string | undefined;

  constructor(code: string, constraint: string | undefined, cause: unknown) {
    super(cause);
    this.name = "PostgresError";
    this.message = `Postgres rejected the statement (${code}).`;
    this.code = code;
    this.constraint = constraint;
  }
}

/**
 * SQLSTATE is exactly five characters from `[0-9A-Z]`. Node's own connection
 * errors carry a `code` too — `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND` — and
 * none of them is five characters, which is what makes the length test a
 * reliable way to tell "the server rejected this" from "there was no server".
 */
const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * The single funnel every raw `pg` failure passes through.
 *
 * Idempotent: our own errors come back untouched, so a `Tx` that has already
 * converted one can be rethrown by the transaction wrapper without being
 * double-wrapped and losing its `code`.
 */
function toDatabaseError(error: unknown): DatabaseUnavailableError {
  if (error instanceof DatabaseUnavailableError) return error;

  if (typeof error === "object" && error !== null) {
    const { code, constraint } = error as { code?: unknown; constraint?: unknown };
    if (typeof code === "string" && SQLSTATE.test(code)) {
      return new PostgresError(
        code,
        typeof constraint === "string" ? constraint : undefined,
        error,
      );
    }
  }

  return new DatabaseUnavailableError(error);
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

/** Whether the back-office has a connection of its own (ADR-0010). */
export function isEditorConfigured(): boolean {
  return Boolean(env.DATABASE_EDITOR_URL);
}

/**
 * Deliberately **not exported**.
 *
 * `query()` below is the only way to reach the database, and that is the whole
 * control: it takes text and values separately, so a caller physically cannot
 * hand Postgres an interpolated string without going out of their way. Export
 * the pool and `getPool().query(`...${input}`)` becomes available — which is
 * the one line that would turn every other precaution in this file into
 * decoration.
 *
 * A lint rule was considered instead and rejected: `row.ts` legitimately
 * composes SQL from a module-scope constant, so any rule strict enough to catch
 * interpolated input also fires on correct code, and a rule that fires on
 * correct code gets disabled. Removing the capability beats policing it.
 */
function getPool(): Pool {
  if (!env.DATABASE_URL) throw new DatabaseUnavailableError("DATABASE_URL is not set");

  pool ??= new Pool({
    connectionString: env.DATABASE_URL,
    // Two shared cores also run n8n and the app; an unbounded pool would let a
    // traffic spike open more connections than Postgres will accept and turn a
    // slow page into a failed one.
    max: 10,
    idleTimeoutMillis: 30_000,
    // A page that hangs waiting for a connection is worse than a page that says
    // the listings cannot be loaded. Fail fast enough to render the error state.
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}

/**
 * Run a query, turning every connection-level failure into one typed error.
 *
 * The repository's callers are pages. They need to distinguish "no listings
 * matched" from "the database did not answer" — the first is an empty
 * catalogue, the second is an apology — and an unwrapped `pg` error makes that
 * distinction by string matching, which nobody does correctly.
 */
export async function query<Row extends Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  try {
    const result = await getPool().query(text, values as unknown[]);
    return result.rows as Row[];
  } catch (error) {
    throw toDatabaseError(error);
  }
}

/**
 * The back-office's pool, as `belso_editor` (ADR-0010).
 *
 * Also not exported, for the reason `getPool` is not: `query(text, values)` and
 * the `Tx` below are the only doors, and a door is only a control while it is
 * the only one.
 *
 * Small on purpose. Three people use the back-office; ten connections reserved
 * for them are ten the storefront cannot have on a two-core box that also runs
 * n8n. If a save ever waits on a connection here, the answer is to find the
 * query holding one, not to raise this number.
 */
let editorPool: Pool | undefined;

function getEditorPool(): Pool {
  if (!env.DATABASE_EDITOR_URL) {
    throw new DatabaseUnavailableError("DATABASE_EDITOR_URL is not set");
  }

  editorPool ??= new Pool({
    connectionString: env.DATABASE_EDITOR_URL,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return editorPool;
}

/** One statement as the editor, outside a transaction. Reads, mostly. */
export async function editorQuery<Row extends Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  try {
    const result = await getEditorPool().query(text, values as unknown[]);
    return result.rows as Row[];
  } catch (error) {
    throw toDatabaseError(error);
  }
}

/**
 * Everything a transaction body is allowed to do.
 *
 * **Deliberately not a `PoolClient`.** Handing the callback the real client
 * would hand it `client.query(\`… ${input}\`)`, `client.release()` and
 * `client.on("error")` — which is to say it would undo, in one parameter,
 * the privacy `getPool` is not exported to preserve. It would also let a
 * callback release the connection the `finally` below is about to release, or
 * issue its own `commit`, and both failures surface far away from their cause.
 *
 * One method, the same shape as `query`, so a statement reads identically
 * inside a transaction and outside one.
 */
export type Tx = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<Row[]>;
};

/**
 * Run `run` inside one transaction as the editor; commit, or roll back and
 * throw.
 *
 * A listing is a property row, N translations, M photographs and M×locale alt
 * texts. Written without this, a save that fails on the fourth statement leaves
 * a listing that exists with half its content — visible in the editor, wrong on
 * the website, and repairable only by hand.
 *
 * Three details, each of which is a bug if it is missing:
 *
 * 1. **The rollback has its own try/catch.** If the connection died mid-write
 *    the rollback fails too, and an unguarded `await` there would replace the
 *    real error — the constraint that was violated — with a connection error,
 *    which is the one message that does not help.
 * 2. **A failed rollback destroys the connection** rather than returning it to
 *    the pool. A client whose transaction state is unknown is a client that
 *    will fail somebody else's unrelated query later.
 * 3. **`release()` in `finally`.** A leaked connection is invisible until the
 *    pool is exhausted, at which point the whole back-office hangs.
 */
export async function editorTransaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await getEditorPool().connect();
  } catch (error) {
    throw toDatabaseError(error);
  }

  // Set when the rollback itself fails, so `finally` knows the connection is
  // no longer safe to reuse.
  let poisoned = false;

  const tx: Tx = {
    async query<Row extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<Row[]> {
      try {
        const result = await client.query(text, values as unknown[]);
        return result.rows as Row[];
      } catch (error) {
        // Converted here, not only at the boundary below, so a callback that
        // catches its own duplicate-slug error sees a `PostgresError` too.
        throw toDatabaseError(error);
      }
    },
  };

  try {
    await tx.query("begin");
    const result = await run(tx);
    await tx.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      poisoned = true;
    }
    /*
     * Rethrown as it is, **not** passed through `toDatabaseError`.
     *
     * Anything raised by a statement was converted inside `tx.query` already.
     * What is left is the callback's own error — and the callback's own error
     * is frequently the point: throwing is how a write says "somebody saved
     * first" (AC-10) and gets the transaction rolled back in one move.
     * Converting here would relabel every one of those as a database outage,
     * so the client would be told the site was broken when her listing was
     * merely out of date.
     */
    throw error;
  } finally {
    client.release(poisoned);
  }
}
