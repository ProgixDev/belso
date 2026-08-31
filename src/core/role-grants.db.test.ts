import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The two roles can do what ADR-0010 says and nothing more.
 *
 * The assertions live in `db/checks/role-grants.sql` rather than here, because
 * they are statements about SQL privileges and reading them as SQL is the point
 * — a reviewer checking a grant should not have to unpick a string builder.
 * The script raises an exception on the first escalation that succeeds or the
 * first legitimate action that is refused, so "it did not throw" is the whole
 * assertion and there is nothing here to keep in sync with it.
 *
 * Needs a real database and the owner connection (`set role` is a superuser
 * move), which is exactly what `pnpm test:db` provides. Skips itself without
 * one, like the rest of this suite.
 */

const script = readFileSync(join(process.cwd(), "db", "checks", "role-grants.sql"), "utf8");

describe.skipIf(!process.env.DATABASE_URL)("role grants", () => {
  it("lets each role do its job, and refuses every escalation (ADR-0010)", async () => {
    const { query } = await import("./db");

    /*
     * No parameters, so this goes over the simple query protocol and Postgres
     * runs the whole script — `begin`, the assertions, `rollback` — as one
     * exchange. Any `raise exception` inside it arrives here as a rejection.
     *
     * There is no row set to assert on (a multi-statement script has several,
     * and `query` returns none of them), so the outcome is folded into a string
     * instead. That is not ceremony: it puts the Postgres message — "ESCALATION
     * — read password hashes succeeded and must not have" — into the diff, which
     * is where whoever broke it will actually read it.
     */
    const outcome = await query(script).then(
      () => "every assertion in db/checks/role-grants.sql passed",
      (error: unknown) => (error instanceof Error ? (error.cause ?? error) : error),
    );

    expect(outcome).toBe("every assertion in db/checks/role-grants.sql passed");
  });
});
