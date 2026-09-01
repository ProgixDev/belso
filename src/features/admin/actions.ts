"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseUnavailableError, editorQuery, isEditorConfigured } from "@/core/db";
import { createSession, endSession } from "@/core/session";
import { ADMIN_PREFIX, ADMIN_SIGN_IN_PATH, safeAdminPath } from "@/core/session-cookie";
import { logger } from "@/lib/logger";
import { clearLoginAllowance, consumeLoginAllowance } from "./login-throttle";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { type SignInResult, signInSchema } from "./types";
import { clientAddress } from "@/lib/network";

/**
 * Signing in and out.
 *
 * **The order of the steps below is the security design**, not an
 * implementation detail, so it is worth stating before the code says it:
 *
 * 1. Both throttle axes are consumed *before* the password is hashed. scrypt is
 *    85ms and 32MB by design; running it first would let anyone spend the box's
 *    memory bandwidth for free, and the limiter would be counting attempts that
 *    had already cost us.
 * 2. An unknown email still pays for a hash (`verifyAgainstDummy`). Returning
 *    early there makes the response time answer the question the error message
 *    refuses to.
 * 3. Every failure returns the same key. `credentials` covers unknown email,
 *    wrong password and disabled account — three different situations that must
 *    look like one (AC-9).
 */

/** The visitor's address, as Traefik forwards it. */
async function networkIdentifier(): Promise<string> {
  const list = await headers();
  return clientAddress(list.get("x-forwarded-for"), list.get("x-real-ip"));
}

type AdminUserRow = {
  id: string;
  password_hash: string;
};

export async function signInAction(
  _previous: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  /*
   * Where she is sent afterwards. Validated here and not only in the proxy,
   * because this arrives as a hidden field in a form anybody can post — the
   * proxy's validation covers the navigation that produced the page, not the
   * submission.
   */
  const destination = safeAdminPath(String(formData.get("next") ?? "")) ?? ADMIN_PREFIX;

  if (!isEditorConfigured()) {
    // Not `credentials`: there is nothing to enumerate when there is no
    // database, and telling the client "wrong password" when the deploy forgot
    // a variable would send her looking in the wrong place for hours.
    logger.error("sign-in attempted with no DATABASE_EDITOR_URL");
    return { error: "unconfigured", email };
  }

  const parsed = signInSchema.safeParse({ email, password });

  try {
    /*
     * Counted before anything is parsed or hashed, and on both axes.
     *
     * The network axis is consumed even for a malformed submission, or an empty
     * form would be a free way to probe. The account axis is keyed on whatever
     * was typed, which is attacker-controlled and could mint a fresh counter
     * per attempt — that is what the network limit above it is for.
     */
    const network = await consumeLoginAllowance("network", await networkIdentifier());
    if (!network.allowed) {
      logger.info("sign-in throttled by network");
      return { error: "throttled", email };
    }

    if (!parsed.success) return { error: "credentials", email };

    const account = await consumeLoginAllowance("account", parsed.data.email);
    if (!account.allowed) {
      logger.info("sign-in throttled by account");
      return { error: "throttled", email };
    }

    const rows = await editorQuery<AdminUserRow>(
      `select id, password_hash from admin_users
        where lower(email) = lower($1) and disabled_at is null`,
      [parsed.data.email],
    );

    const user = rows[0];

    /*
     * The dummy verify. Without it this branch returns in under a millisecond
     * while a real account takes a quarter of a second, and the response time
     * says which addresses have accounts here — for a three-person agency,
     * enough to know the client's own address is one.
     */
    if (!user) {
      await verifyAgainstDummy(parsed.data.password);
      return { error: "credentials", email };
    }

    if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
      return { error: "credentials", email };
    }

    // Five typos then the right password must not leave her locked out for the
    // rest of the window. The network counter is deliberately left alone.
    await clearLoginAllowance(parsed.data.email);
    await createSession(user.id);
  } catch (error) {
    /*
     * Fails closed. The limiter, the lookup and the session insert all need the
     * database, so an outage lands here — and the only safe answer is to refuse
     * rather than to sign somebody in with no way to record or revoke it.
     *
     * Nothing about the attempt is logged beyond the error's name: the payload
     * is an email address and a password.
     */
    logger.error("sign-in failed", {
      cause: error instanceof DatabaseUnavailableError ? error.name : "unknown",
    });
    return { error: "generic", email };
  }

  /*
   * Outside the try, deliberately. `redirect()` works by throwing, so calling
   * it inside would be caught by the block above and reported as a database
   * failure — a successful sign-in rendering as "something went wrong".
   */
  redirect(destination);
}

/** Sign out, from anywhere in the back-office. */
export async function signOutAction(): Promise<void> {
  await endSession();
  redirect(ADMIN_SIGN_IN_PATH);
}
