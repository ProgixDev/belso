import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` resolves by the `react-server` export condition, not by the
// environment, so under Vitest it resolves to the module that throws on import.
vi.mock("server-only", () => ({}));

/**
 * `db.ts` in isolation: transactions, and the error taxonomy the editor reads.
 *
 * These are unit tests against a faked `pg`, not database tests, and the
 * distinction is the point. What they pin is the *shape* of the wrapper — that
 * a rollback is issued, that it cannot swallow the error it was reacting to,
 * that a connection is always released — and those are exactly the paths a real
 * database will not take on a good day. `writes.db.test.ts` proves the same
 * helper against Postgres; this proves the failure branches, which a healthy
 * database refuses to demonstrate.
 *
 * The file is `db.test.ts`, not `db.db.test.ts`: the second spelling is the
 * convention for suites that need a live database, and `pnpm test:db` matches
 * it with `*.db.test.ts`. This one runs in the ordinary suite, everywhere.
 */

type Recorded = { text: string; values: unknown[] };

const hoisted = vi.hoisted(() => {
  const state = {
    /** Every statement the fake connection was asked to run, in order. */
    statements: [] as Recorded[],
    /** `release(destroy)` calls, so the poisoned-connection path is observable. */
    releases: [] as boolean[],
    /** Configs the pool was constructed with. */
    configs: [] as Record<string, unknown>[],
    /** Statement text that should reject, and with what. */
    failures: new Map<string, unknown>(),
    /** Set when `connect()` itself should reject. */
    connectError: undefined as unknown,
  };

  class FakePool {
    constructor(config: Record<string, unknown>) {
      state.configs.push(config);
    }

    async connect() {
      if (state.connectError) throw state.connectError;
      return {
        async query(text: string, values: unknown[] = []) {
          state.statements.push({ text, values });
          const failure = state.failures.get(text);
          if (failure) throw failure;
          return { rows: [] };
        },
        release(destroy?: boolean) {
          state.releases.push(Boolean(destroy));
        },
      };
    }

    async query(text: string, values: unknown[] = []) {
      state.statements.push({ text, values });
      const failure = state.failures.get(text);
      if (failure) throw failure;
      return { rows: [] };
    }
  }

  return { state, FakePool };
});

vi.mock("pg", () => ({ Pool: hoisted.FakePool }));

const { state } = hoisted;

/** A `pg` error carries its SQLSTATE on `code`, and names the constraint. */
function pgError(code: string, constraint?: string): Error & { code: string } {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code,
    constraint,
  });
}

/**
 * `env.ts` parses `process.env` at import, so the connection strings have to be
 * in place before `db.ts` is loaded — hence the reset-and-reimport per test
 * rather than a top-level import.
 */
async function loadDb(env: Record<string, string | undefined> = {}) {
  vi.stubEnv("DATABASE_URL", "postgres://belso@127.0.0.1:5432/belso");
  vi.stubEnv("DATABASE_EDITOR_URL", "postgres://belso_editor@127.0.0.1:5432/belso");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./db");
}

beforeEach(() => {
  state.statements.length = 0;
  state.releases.length = 0;
  state.configs.length = 0;
  state.failures.clear();
  state.connectError = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("editorTransaction", () => {
  it("wraps the callback in begin/commit and returns its value", async () => {
    const { editorTransaction } = await loadDb();

    const result = await editorTransaction(async (tx) => {
      await tx.query("insert into properties (slug) values ($1)", ["villa-oasis"]);
      return "written";
    });

    expect(result).toBe("written");
    expect(state.statements.map((s) => s.text)).toEqual([
      "begin",
      "insert into properties (slug) values ($1)",
      "commit",
    ]);
    // Returned to the pool intact — not destroyed.
    expect(state.releases).toEqual([false]);
  });

  it("rolls back when the callback throws, and does not commit", async () => {
    const { editorTransaction } = await loadDb();

    await expect(
      editorTransaction(async (tx) => {
        await tx.query("insert into properties (slug) values ($1)", ["villa-oasis"]);
        throw new Error("the caller changed its mind");
      }),
    ).rejects.toThrow("the caller changed its mind");

    const texts = state.statements.map((s) => s.text);
    expect(texts).toContain("rollback");
    expect(texts).not.toContain("commit");
    expect(state.releases).toEqual([false]);
  });

  it("does not let a failing rollback mask the error that caused it", async () => {
    const { editorTransaction } = await loadDb();
    // The connection died mid-write: the statement fails, and so does the
    // rollback we issue in response.
    state.failures.set("rollback", new Error("connection terminated unexpectedly"));

    /*
     * The assertion that matters. Without the inner try/catch the rollback's
     * rejection replaces the original, and the editor tells the client the
     * database is unreachable when in fact her slug was taken — a message that
     * sends her to the wrong person for help.
     */
    await expect(
      editorTransaction(async (tx) => {
        await tx.query("insert into properties (slug) values ($1)", ["villa-oasis"]);
        throw new Error("the real problem");
      }),
    ).rejects.toThrow("the real problem");

    // And the connection is destroyed rather than handed to the next request in
    // an unknown transaction state.
    expect(state.releases).toEqual([true]);
  });

  it("hands the callback's own error back unchanged", async () => {
    const { editorTransaction, DatabaseUnavailableError } = await loadDb();
    class ConcurrentEditError extends Error {}
    const thrown = new ConcurrentEditError("somebody saved first");

    const caught = await editorTransaction(async () => {
      throw thrown;
    }).catch((e: unknown) => e);

    /*
     * Throwing is how a write says "somebody saved first" and rolls back in one
     * move (AC-10). An earlier version funnelled *everything* from the catch
     * through the error converter, which relabelled that as a database outage —
     * so the client would have been told the site was broken when her listing
     * was merely out of date. Identity, not just the message: nothing may
     * re-wrap it on the way out.
     */
    expect(caught).toBe(thrown);
    expect(caught).not.toBeInstanceOf(DatabaseUnavailableError);
    expect(state.statements.map((s) => s.text)).toEqual(["begin", "rollback"]);
  });

  it("releases the connection even when commit fails", async () => {
    const { editorTransaction } = await loadDb();
    state.failures.set("commit", pgError("40001"));

    await expect(editorTransaction(async () => "unreachable")).rejects.toThrow();
    expect(state.releases).toHaveLength(1);
  });

  it("gives the callback a Tx and nothing else", async () => {
    const { editorTransaction } = await loadDb();

    let received: object | undefined;
    await editorTransaction(async (tx) => {
      received = tx;
    });

    /*
     * A `PoolClient` would also carry `release`, `on` and `connection`. The
     * point of the narrow type is that the callback cannot release the
     * connection the `finally` is about to release, cannot issue its own
     * `commit`, and cannot reach around `query(text, values)`.
     */
    expect(Object.keys(received ?? {})).toEqual(["query"]);
  });

  it("refuses to open a transaction with no editor connection configured", async () => {
    const { editorTransaction, DatabaseUnavailableError } = await loadDb({
      DATABASE_EDITOR_URL: "",
    });

    await expect(editorTransaction(async () => "unreachable")).rejects.toBeInstanceOf(
      DatabaseUnavailableError,
    );
    // Never reached the pool: no connection was opened to be leaked.
    expect(state.releases).toEqual([]);
  });

  it("never falls back to the storefront connection string", async () => {
    // ADR-0010's one irreversible mistake: an editor pool that quietly opens as
    // `belso_app` would fail later, deep inside a write, as a permission error.
    const { editorQuery } = await loadDb({ DATABASE_EDITOR_URL: "" });

    await expect(editorQuery("select 1")).rejects.toThrow();
    expect(state.configs).toEqual([]);
  });
});

describe("PostgresError", () => {
  it("is a DatabaseUnavailableError, so existing catchers still catch it", async () => {
    const { editorQuery, DatabaseUnavailableError, PostgresError } = await loadDb();
    state.failures.set("insert", pgError("23505", "properties_slug_key"));

    const error = await editorQuery("insert").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PostgresError);
    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error).toBeInstanceOf(Error);
  });

  it("carries the SQLSTATE and the constraint the editor needs to name", async () => {
    const { editorQuery, PostgresError } = await loadDb();
    state.failures.set("insert", pgError("23505", "properties_slug_key"));

    const error = (await editorQuery("insert").catch((e: unknown) => e)) as InstanceType<
      typeof PostgresError
    >;

    expect(error).toBeInstanceOf(PostgresError);
    expect(error.code).toBe("23505");
    expect(error.constraint).toBe("properties_slug_key");
  });

  it("is not raised for a connection failure, which has no SQLSTATE", async () => {
    const { query, DatabaseUnavailableError, PostgresError } = await loadDb();
    state.failures.set(
      "select 1",
      Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      }),
    );

    const error = await query("select 1").catch((e: unknown) => e);

    // `ECONNREFUSED` is twelve characters; SQLSTATE is always five, which is
    // what lets one `code` field carry both without ambiguity.
    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error).not.toBeInstanceOf(PostgresError);
  });

  it("survives the transaction boundary without being re-wrapped", async () => {
    const { editorTransaction, PostgresError } = await loadDb();
    state.failures.set("insert", pgError("23505", "properties_slug_key"));

    const error = (await editorTransaction(async (tx) => tx.query("insert")).catch(
      (e: unknown) => e,
    )) as InstanceType<typeof PostgresError>;

    // Converted once inside `Tx.query`, rethrown unchanged by the wrapper. A
    // second wrap would leave the editor with a generic outage error and no
    // way to say "that address is already taken".
    expect(error).toBeInstanceOf(PostgresError);
    expect(error.code).toBe("23505");
  });
});
