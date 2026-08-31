/**
 * Public API of the admin slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 *
 * Deliberately small, and deliberately **not** exporting the session. Reading
 * who is signed in is `@/core/session`, because `features/properties` needs it
 * too and a feature may not import a feature. What lives here is the sign-in
 * surface: the form, its action, and the password functions the provisioning
 * script needs.
 */

export { SignInForm } from "./components/sign-in-form";
export { signInAction, signOutAction } from "./actions";
export { hashPassword, verifyPassword } from "./password";
export type { SignInError, SignInResult } from "./types";
