import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The session contract, against a faked database and cookie store.
 *
 * The assertion the whole file exists for is the first one: **the token the
 * browser holds is never the value the database holds.** Everything else here
 * is scaffolding around it. Get that wrong and the failure is invisible — every
 * test passes, every sign-in works, and the only symptom is that a backup, a
 * `pg_dump` in a support thread, or read access to one table is a stack of live
 * sessions for anyone who finds it.
 */

const mocks = vi.hoisted(() => ({
  editorQuery: vi.fn<(sql: string, values?: readonly unknown[]) => Promise<unknown[]>>(),
  isEditorConfigured: vi.fn(() => true),
  redirect: vi.fn((path: string) => {
    // `redirect()` throws in Next, and callers depend on that: `requireSession`
    // has no return value for the unauthenticated case.
    throw new Error(`REDIRECT ${path}`);
  }),
  jar: new Map<string, string>(),
  cookieOptions: new Map<string, Record<string, unknown>>(),
  /** Drives the Secure flag. Assignable, so both branches are reachable. */
  nodeEnv: "test" as string,
}));

/*
 * `session.ts` reads `env.NODE_ENV` and nothing else from this module. Mocked so
 * the Secure flag can be tested in both directions — the real module reads the
 * process, which under vitest is always "test".
 */
vi.mock("./env", () => ({
  get env() {
    return { NODE_ENV: mocks.nodeEnv };
  },
}));

vi.mock("./db", () => ({
  editorQuery: mocks.editorQuery,
  isEditorConfigured: mocks.isEditorConfigured,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      mocks.jar.set(name, value);
      mocks.cookieOptions.set(name, options);
    },
    delete: (name: string) => {
      mocks.jar.delete(name);
    },
  }),
}));

const COOKIE = "belso_session";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Reload per test: `currentSession` is memoised, and the jar is module state. */
async function loadSession() {
  vi.resetModules();
  return import("./session");
}

beforeEach(() => {
  mocks.jar.clear();
  mocks.cookieOptions.clear();
  mocks.nodeEnv = "test";
  mocks.editorQuery.mockReset().mockResolvedValue([]);
  mocks.isEditorConfigured.mockReturnValue(true);
  mocks.redirect.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSession", () => {
  it("stores the digest of the token and never the token itself", async () => {
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");

    const token = mocks.jar.get(COOKIE);
    expect(token).toBeTruthy();

    const insert = mocks.editorQuery.mock.calls.find(([sql]) =>
      String(sql).includes("insert into admin_sessions"),
    );
    expect(insert).toBeDefined();

    const [, values] = insert as unknown as [string, unknown[]];
    const [stored] = values as [Buffer, string, Date];

    // The two halves of the contract, stated separately so a failure says which
    // one broke.
    expect(stored).toEqual(sha256(token as string));
    expect(Buffer.isBuffer(stored) && stored.toString("utf8")).not.toBe(token);

    /*
     * And the belt-and-braces version: the raw token must not appear anywhere
     * in anything sent to the database — not as a value, not spliced into SQL.
     */
    const everythingSent = JSON.stringify(mocks.editorQuery.mock.calls);
    expect(everythingSent).not.toContain(token);
  });

  it("gives the cookie the flags that make it a session cookie", async () => {
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");
    const options = mocks.cookieOptions.get(COOKIE);

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      // Scoped, so the public storefront never carries the session.
      path: "/admin",
    });
  });

  it("sends Secure on the session cookie outside development", async () => {
    /*
     * Guarded in both directions because the expression has now been rewritten
     * three times — `process.env.NODE_ENV === "production"`, then
     * `env.NODE_ENV === "production"`, then `!== "development"` — each on a
     * reasoned argument, with nothing that would go red if the next rewrite
     * dropped the flag. It is written as "not development" to fail closed:
     * `env.NODE_ENV` is a runtime read whose schema defaults to development, and
     * `next start` only fills the variable when it is empty, so a deploy that
     * exports NODE_ENV=development would otherwise ship the cookie unprotected.
     */
    mocks.nodeEnv = "production";
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");

    expect(mocks.cookieOptions.get(COOKIE)).toMatchObject({ secure: true });
  });

  it("omits Secure in development, so localhost over plain http still works", async () => {
    mocks.nodeEnv = "development";
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");

    expect(mocks.cookieOptions.get(COOKIE)).toMatchObject({ secure: false });
  });

  it("issues a different token every time", async () => {
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");
    const first = mocks.jar.get(COOKIE);
    await createSession("11111111-1111-1111-1111-111111111111");
    const second = mocks.jar.get(COOKIE);

    expect(first).not.toBe(second);
  });

  it("sweeps expired sessions", async () => {
    const { createSession } = await loadSession();

    await createSession("11111111-1111-1111-1111-111111111111");

    expect(
      mocks.editorQuery.mock.calls.some(([sql]) =>
        String(sql).includes("delete from admin_sessions where expires_at < now()"),
      ),
    ).toBe(true);
  });
});

describe("currentSession", () => {
  it("is null with no cookie, and asks the database nothing", async () => {
    const { currentSession } = await loadSession();

    expect(await currentSession()).toBeNull();
    expect(mocks.editorQuery).not.toHaveBeenCalled();
  });

  it("is null when the back-office has no connection configured", async () => {
    mocks.isEditorConfigured.mockReturnValue(false);
    const { currentSession } = await loadSession();
    mocks.jar.set(COOKIE, "a-token");

    // Not a throw: an unset DATABASE_EDITOR_URL must not turn every admin URL
    // into a 500 (ADR-0010).
    expect(await currentSession()).toBeNull();
  });

  it("looks the session up by digest, never by the token", async () => {
    mocks.editorQuery.mockResolvedValue([
      { id: "u-1", email: "sofia@belso.ma", display_name: "Sofia" },
    ]);
    const { currentSession } = await loadSession();
    mocks.jar.set(COOKIE, "a-token");

    const session = await currentSession();

    expect(session).toEqual({ userId: "u-1", email: "sofia@belso.ma", displayName: "Sofia" });

    const [, values] = mocks.editorQuery.mock.calls[0] as unknown as [string, unknown[]];
    expect(values[0]).toEqual(sha256("a-token"));
  });

  it("is null when the query returns nothing — expired, unknown or disabled", async () => {
    mocks.editorQuery.mockResolvedValue([]);
    const { currentSession } = await loadSession();
    mocks.jar.set(COOKIE, "a-token");

    /*
     * All three refusals are one empty result, because all three are conditions
     * in the same `where`. That is deliberate: a disabled account must stop
     * working on the next request, and a check written in TypeScript beside the
     * query is a check a future caller can forget to run.
     */
    expect(await currentSession()).toBeNull();
  });
});

describe("requireSession", () => {
  it("redirects to the sign-in page when nobody is signed in", async () => {
    const { requireSession, ADMIN_SIGN_IN_PATH } = await loadSession();

    await expect(requireSession()).rejects.toThrow(`REDIRECT ${ADMIN_SIGN_IN_PATH}`);
    expect(mocks.redirect).toHaveBeenCalledWith(ADMIN_SIGN_IN_PATH);
  });

  it("returns the session when there is one", async () => {
    mocks.editorQuery.mockResolvedValue([
      { id: "u-1", email: "sofia@belso.ma", display_name: "Sofia" },
    ]);
    const { requireSession } = await loadSession();
    mocks.jar.set(COOKIE, "a-token");

    await expect(requireSession()).resolves.toMatchObject({ userId: "u-1" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("endSession", () => {
  it("destroys the row before clearing the cookie", async () => {
    const { createSession, endSession } = await loadSession();
    await createSession("11111111-1111-1111-1111-111111111111");
    const token = mocks.jar.get(COOKIE) as string;
    mocks.editorQuery.mockClear();

    await endSession();

    const [sql, values] = mocks.editorQuery.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("delete from admin_sessions");
    expect(values[0]).toEqual(sha256(token));
    expect(mocks.jar.has(COOKIE)).toBe(false);
  });

  it("clears the cookie even when there was no session to destroy", async () => {
    const { endSession } = await loadSession();

    await endSession();

    expect(mocks.editorQuery).not.toHaveBeenCalled();
    expect(mocks.jar.has(COOKIE)).toBe(false);
  });
});
