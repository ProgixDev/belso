import "server-only";
import { Pool } from "pg";
import { env } from "./env";

/**
 * The connection pool, and the only place the application opens one.
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

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
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
    if (error instanceof DatabaseUnavailableError) throw error;
    throw new DatabaseUnavailableError(error);
  }
}
