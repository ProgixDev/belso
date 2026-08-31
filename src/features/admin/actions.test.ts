import { describe, expect, it, vi } from "vitest";

// `server-only` resolves by export condition, not by environment.
vi.mock("server-only", () => ({}));

/**
 * Sign-in, against a faked database.
 *
 * The tests that matter here are the negative ones, and they are all one
 * question: **can somebody with a login page work out which addresses have
 * accounts?** (AC-9.) Three separate mechanisms have to hold — the same error
 * key, the same shape of result, and the same cost — and each is easy to break
 * with a change that looks like an improvement. "Let's tell them the account is
 * disabled so they stop guessing" is the exact patch this file exists to fail.
 */

const mocks = vi.hoisted(() => ({
  editorQuery: vi.fn<(sql: string, values?: readonly unknown[]) => Promise<unknown[]>>(),
  isEditorConfigured: vi.fn(() => true),
  createSession: vi.fn(async () => undefined),
  endSession: vi.fn(async () => undefined),
  consumeLoginAllowance:
    vi.fn<(axis: "account" | "network", identifier: string) => Promise<{ allowed: boolean }>>(),
  clearLoginAllowance: vi.fn<(email: string) => Promise<void>>(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
  forwardedFor: "203.0.113.10",
}));

vi.mock("@/core/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/db")>();
  return {
    ...actual,
    editorQuery: mocks.editorQuery,
    isEditorConfigured: mocks.isEditorConfigured,
  };
});

vi.mock("@/core/session", () => ({
  createSession: mocks.createSession,
  endSession: mocks.endSession,
}));

vi.mock("./login-throttle", () => ({
  consumeLoginAllowance: mocks.consumeLoginAllowance,
  clearLoginAllowance: mocks.clearLoginAllowance,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", mocks.forwardedFor]]),
}));

/** A real hash, so `verifyPassword` does real work rather than being stubbed. */
async function accountFor(password: string) {
  const { hashPassword } = await import("./password");
  return { id: "u-1", password_hash: await hashPassword(password) };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

function reset() {
  mocks.editorQuery.mockReset().mockResolvedValue([]);
  mocks.isEditorConfigured.mockReturnValue(true);
  mocks.createSession.mockClear();
  mocks.consumeLoginAllowance.mockReset().mockResolvedValue({ allowed: true });
  mocks.clearLoginAllowance.mockClear();
  mocks.redirect.mockClear();
}

describe("signInAction — AC-9, no enumeration", () => {
  it("answers an unknown email exactly as it answers a wrong password", async () => {
    reset();
    const { signInAction } = await import("./actions");

    mocks.editorQuery.mockResolvedValue([]);
    const unknown = await signInAction(null, form({ email: "personne@belso.ma", password: "x" }));

    reset();
    mocks.editorQuery.mockResolvedValue([await accountFor("le bon mot de passe")]);
    const wrong = await signInAction(null, form({ email: "sofia@belso.ma", password: "x" }));

    // Not "both are falsy" — byte-identical apart from the address echoed back,
    // which the person typing already knows.
    expect(unknown.error).toBe("credentials");
    expect(wrong.error).toBe("credentials");
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(wrong).sort());
  });

  it("answers a disabled account the same way", async () => {
    reset();
    const { signInAction } = await import("./actions");

    /*
     * The query filters `disabled_at is null`, so a disabled account is simply
     * no row — which is what makes this indistinguishable rather than merely
     * worded the same. A TypeScript check after the lookup would be a separate
     * branch, and separate branches acquire separate messages.
     */
    const [sql] = (await (async () => {
      mocks.editorQuery.mockResolvedValue([]);
      await signInAction(null, form({ email: "partie@belso.ma", password: "x" }));
      return mocks.editorQuery.mock.calls[0] as unknown as [string, unknown[]];
    })()) as [string, unknown[]];

    expect(sql).toContain("disabled_at is null");
  });

  it("pays for a hash even when the email is unknown", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.editorQuery.mockResolvedValue([]);

    const start = performance.now();
    await signInAction(null, form({ email: "personne@belso.ma", password: "x" }));
    const elapsed = performance.now() - start;

    /*
     * scrypt at these parameters is ~85ms on a developer machine. The bound is
     * deliberately far below that — a timing assertion tight enough to be
     * precise would be the flakiest test in the repo. What it catches is the
     * regression that matters: an early `return` on the unknown branch, which
     * would come back in under a millisecond.
     */
    expect(elapsed).toBeGreaterThan(10);
  });
});

describe("signInAction — throttling", () => {
  it("counts the network before parsing, so a malformed post is not free", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.consumeLoginAllowance.mockResolvedValue({ allowed: false });

    const result = await signInAction(null, form({ email: "", password: "" }));

    expect(result.error).toBe("throttled");
    expect(mocks.consumeLoginAllowance).toHaveBeenCalledWith("network", "203.0.113.10");
    // Refused before the lookup and before any hashing.
    expect(mocks.editorQuery).not.toHaveBeenCalled();
  });

  it("counts both axes on a well-formed attempt", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.editorQuery.mockResolvedValue([]);

    await signInAction(null, form({ email: "sofia@belso.ma", password: "x" }));

    const axes = mocks.consumeLoginAllowance.mock.calls.map(([axis]) => axis);
    // Either alone leaves a hole: one machine grinding a password list, or a
    // botnet grinding one account from a thousand addresses.
    expect(axes).toEqual(["network", "account"]);
  });

  it("does not hash when the account axis is exhausted", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.consumeLoginAllowance
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false });

    const result = await signInAction(null, form({ email: "sofia@belso.ma", password: "x" }));

    expect(result.error).toBe("throttled");
    expect(mocks.editorQuery).not.toHaveBeenCalled();
  });
});

describe("signInAction — the happy path and the broken one", () => {
  it("creates a session and redirects to the back-office", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.editorQuery.mockResolvedValue([await accountFor("le bon mot de passe")]);

    await expect(
      signInAction(null, form({ email: "sofia@belso.ma", password: "le bon mot de passe" })),
    ).rejects.toThrow("REDIRECT /admin");

    expect(mocks.createSession).toHaveBeenCalledWith("u-1");
    // Her own failed attempts are forgiven; the network's are not.
    expect(mocks.clearLoginAllowance).toHaveBeenCalledWith("sofia@belso.ma");
  });

  it("refuses to redirect anywhere but the back-office", async () => {
    const { signInAction } = await import("./actions");

    for (const next of ["https://evil.example/", "//evil.example", "/fr/biens", "/admin/../etc"]) {
      reset();
      mocks.editorQuery.mockResolvedValue([await accountFor("bon")]);

      await expect(
        signInAction(null, form({ email: "sofia@belso.ma", password: "bon", next })),
      ).rejects.toThrow("REDIRECT /admin");
    }
  });

  it("honours a legitimate next", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.editorQuery.mockResolvedValue([await accountFor("bon")]);

    await expect(
      signInAction(
        null,
        form({ email: "sofia@belso.ma", password: "bon", next: "/admin/listings/p-01" }),
      ),
    ).rejects.toThrow("REDIRECT /admin/listings/p-01");
  });

  it("says the back-office is unconfigured rather than blaming the password", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.isEditorConfigured.mockReturnValue(false);

    const result = await signInAction(null, form({ email: "sofia@belso.ma", password: "bon" }));

    /*
     * There is nothing to enumerate when there is no database, and telling the
     * client "wrong password" because a deploy forgot a variable would send her
     * hunting for hours in the one place the problem is not.
     */
    expect(result.error).toBe("unconfigured");
    expect(mocks.consumeLoginAllowance).not.toHaveBeenCalled();
  });

  it("fails closed when the database is unreachable", async () => {
    reset();
    const { signInAction } = await import("./actions");
    mocks.consumeLoginAllowance.mockRejectedValue(new Error("no connection"));

    const result = await signInAction(null, form({ email: "sofia@belso.ma", password: "bon" }));

    expect(result.error).toBe("generic");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
