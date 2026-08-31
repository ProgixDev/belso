import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The login throttle against real Postgres (AC-9).
 *
 * Against a mock this would prove nothing worth proving. The whole mechanism is
 * one `insert … on conflict do update … returning count` — a window that resets
 * itself, a counter that increments atomically — and every part of that is the
 * database's behaviour, not ours. A stubbed `editorQuery` would test the return
 * value we told it to return.
 *
 * Writes to `admin_login_throttle`, so it lives in the `pnpm test:db` suite,
 * which refuses to run against anything but a `_test` database.
 */

const configured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_EDITOR_URL);

describe.skipIf(!configured)("consumeLoginAllowance", () => {
  /** Unique per test, so the two axes and the two runs never share a bucket. */
  let stamp: string;

  beforeEach(() => {
    stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(async () => {
    /*
     * Cleared through `query` — the owner connection — and not `editorQuery`,
     * because `belso_editor` has no `delete` on this table and should not: the
     * application never removes a counter, it zeroes one. Tearing down a
     * fixture is the harness's job, not the app's, and borrowing the app's
     * credential to do it would quietly argue for a grant nothing needs.
     */
    const { query } = await import("@/core/db");
    await query("delete from admin_login_throttle");
  });

  it("refuses the sixth attempt on one account", async () => {
    const { consumeLoginAllowance } = await import("./login-throttle");
    const email = `sofia+${stamp}@belso.ma`;

    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      outcomes.push((await consumeLoginAllowance("account", email)).allowed);
    }

    expect(outcomes).toEqual([true, true, true, true, true, false]);
  });

  it("counts the same account under any capitalisation", async () => {
    const { consumeLoginAllowance } = await import("./login-throttle");
    const email = `Sofia+${stamp}@Belso.MA`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeLoginAllowance("account", email.toLowerCase());
    }

    /*
     * Without the lowercasing in `keyFor`, `Sofia@` and `sofia@` are two
     * buckets and the real allowance is doubled — or multiplied by however many
     * capitalisations somebody cares to try, which is the entire alphabet.
     */
    const next = await consumeLoginAllowance("account", email);
    expect(next.allowed).toBe(false);
  });

  it("keeps the two axes apart", async () => {
    const { consumeLoginAllowance } = await import("./login-throttle");
    const email = `bloque+${stamp}@belso.ma`;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await consumeLoginAllowance("account", email);
    }

    // The account is exhausted; the office address behind it must not be, or
    // one person's typos would lock out their two colleagues.
    expect((await consumeLoginAllowance("account", email)).allowed).toBe(false);
    expect((await consumeLoginAllowance("network", "203.0.113.7")).allowed).toBe(true);
  });

  it("counts a whole IPv6 /64 as one network", async () => {
    const { consumeLoginAllowance } = await import("./login-throttle");
    // A residential IPv6 client is handed a /64 and rotates inside it freely.
    // Counting full addresses would give one attacker twenty fresh buckets a
    // second — the limit would be arithmetic, not a limit.
    const prefix = "2a01:cb00:8f2:3400";

    let last = { allowed: true };
    for (let attempt = 0; attempt < 21; attempt += 1) {
      last = await consumeLoginAllowance("network", `${prefix}:${attempt}:1:1:1`);
    }

    expect(last.allowed).toBe(false);
  });

  it("lets a network run further than one account, deliberately", async () => {
    const { consumeLoginAllowance } = await import("./login-throttle");

    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      outcomes.push((await consumeLoginAllowance("network", "198.51.100.4")).allowed);
    }

    // Twenty through, twenty-first refused: the agency's three people share one
    // office address, and an account-tight network limit would be a
    // self-inflicted outage of the back-office.
    expect(outcomes.every(Boolean)).toBe(true);
    expect((await consumeLoginAllowance("network", "198.51.100.4")).allowed).toBe(false);
  });

  it("forgives an account's failures once it signs in, but not the network's", async () => {
    const { clearLoginAllowance, consumeLoginAllowance } = await import("./login-throttle");
    const email = `retour+${stamp}@belso.ma`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeLoginAllowance("account", email);
    }
    await consumeLoginAllowance("network", "198.51.100.9");

    await clearLoginAllowance(email);

    // Five typos then the right password must not leave her locked out for the
    // rest of the window.
    expect((await consumeLoginAllowance("account", email)).allowed).toBe(true);

    /*
     * And the network counter survives, which is the half that is easy to get
     * wrong: one successful sign-in from the office must not wipe the evidence
     * of somebody grinding away behind the same address.
     */
    const { query } = await import("@/core/db");
    const rows = await query<{ count: number }>(
      "select count from admin_login_throttle order by count desc",
    );

    // Two buckets: the account, reset to zero, and the network, untouched.
    expect(rows.map((row) => row.count)).toEqual([1, 1]);
  });
});
