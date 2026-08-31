import { z } from "zod";

/**
 * The sign-in form's contract.
 *
 * The result carries an error **key**, never a sentence, for the same reason
 * the enquiry slice does: the copy belongs to the component, not to the action.
 * Here it also means the two failures that must be indistinguishable —
 * unknown email and wrong password — are literally the same value, rather than
 * two strings somebody has to keep identical by hand.
 */

export const signInSchema = z.object({
  // Not `.email()`. Validation strictness here is an oracle: "that is not an
  // email" and "that email is not an account" are different responses to
  // different inputs, and the second is the thing we refuse to say. Anything
  // non-empty gets the same treatment, including the same scrypt cost.
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
});

export type SignInError =
  /** Unknown email, wrong password, or a disabled account. Deliberately one key. */
  | "credentials"
  /** Too many attempts on this account or from this network (AC-9). */
  | "throttled"
  /** No `DATABASE_EDITOR_URL`: the back-office is not configured (ADR-0010). */
  | "unconfigured"
  /** The database did not answer. */
  | "generic";

export type SignInResult = {
  error: SignInError;
  /** Echoed back so a failed attempt does not clear the field she typed. */
  email: string;
};
