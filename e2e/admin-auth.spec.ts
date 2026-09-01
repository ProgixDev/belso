import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * AC-1 and AC-9 — the back-office refuses everyone who is not signed in.
 *
 * **The two halves of AC-1 are tested separately because they are two claims.**
 * A back-office address refusing a signed-out GET is the obvious one and the
 * one everybody writes. A Server Action refusing a signed-out POST is the one
 * that ships open: an action is an independently addressable endpoint, reachable
 * by a forged request without the page it lives on ever rendering, so a layout
 * that checks proves nothing about a request that never touched the layout. The
 * proxy deliberately lets a signed-out POST through so that this test is
 * measuring the action's own check rather than a redirect standing in for one.
 *
 * Needs a real database and an account. Skipped without them, loudly rather
 * than silently: a test that passes because the thing it tests was never set up
 * is worse than no test (the same rule `db-down.spec.ts` follows).
 *
 *   DATABASE_URL=…/belso_test DATABASE_EDITOR_URL=…/belso_test \
 *   BELSO_E2E_ADMIN_EMAIL=… BELSO_E2E_ADMIN_PASSWORD=… pnpm e2e admin-auth
 */

const email = process.env.BELSO_E2E_ADMIN_EMAIL;
const password = process.env.BELSO_E2E_ADMIN_PASSWORD;

test.skip(
  !email || !password,
  "needs a back-office account (BELSO_E2E_ADMIN_EMAIL / BELSO_E2E_ADMIN_PASSWORD)",
);

/**
 * Every back-office address a signed-out request might try.
 *
 * Two of these do not exist yet — the listing screens are Phase 3 — and that is
 * deliberate rather than an oversight. The gate runs in the proxy, before
 * routing, so a signed-out request must be turned away whether or not the page
 * behind it was ever built. Testing only the routes that exist would leave the
 * gate depending on the router, which is the wrong way round.
 */
const GATED = ["/admin", "/admin/listings", "/admin/listings/p-01"];

test.describe("signed out", () => {
  test("@cuj AC-1: every back-office address redirects, and leaks no listing", async ({ page }) => {
    for (const path of GATED) {
      const response = await page.goto(path);

      // Landed on the sign-in form, not on the page that was asked for.
      await expect(page).toHaveURL(/\/admin\/connexion/);
      await expect(page.getByRole("heading", { name: "Espace de gestion" })).toBeVisible();

      /*
       * The negative that matters more than the redirect. A gate that renders
       * the page and *then* redirects has already put the catalogue — drafts
       * included — into a response that went over the wire. The body is what
       * proves it did not.
       *
       * Real values from the catalogue, not the id from the URL above: `p-01`
       * appears in the sign-in form's `next` field because the visitor asked
       * for it, and asserting on that would have failed for a reason that is
       * not a leak — which is how a test ends up being loosened until it
       * checks nothing.
       */
      const body = (await response?.text()) ?? "";
      for (const secret of ["Villa vue Atlas", "BL-1101", "Palmeraie"]) {
        expect(body, `${path} leaked ${secret}`).not.toContain(secret);
      }

      // And the return trip is remembered, so being bounced to sign in does not
      // also mean losing your place.
      if (path !== "/admin") {
        expect(page.url()).toContain(`next=${encodeURIComponent(path)}`);
      }
    }

    await shot(page, "50-admin-signed-out");
  });

  test("AC-1: a signed-out POST to a Server Action is refused and writes nothing", async ({
    request,
  }) => {
    /*
     * Posted with `Next-Action`, which is what makes this a Server Action
     * invocation rather than an ordinary form post. The id is deliberately a
     * made-up one: we are not trying to hit a specific action, we are proving
     * that reaching the back-office's action endpoint without a session gets
     * nowhere. A real id would make this test break every time an action is
     * added or renamed, for no extra assurance.
     */
    const response = await request.post("/admin/listings", {
      headers: {
        "Next-Action": "00000000000000000000000000000000000000000000",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: "[]",
      maxRedirects: 0,
    });

    // Never a 200 carrying a successful mutation: refused, redirected to sign
    // in, or not found — any of which is "it did not run".
    expect(response.status()).not.toBe(200);
    expect(await response.text()).not.toContain("p-01");
  });
});

test.describe("signing in", () => {
  test("@cuj AC-9: a wrong password says the same thing as an unknown address", async ({
    page,
  }) => {
    await page.goto("/admin/connexion");

    const attempt = async (address: string, secret: string) => {
      await page.getByLabel("Adresse e-mail").fill(address);
      await page.getByLabel("Mot de passe").fill(secret);
      await page.getByRole("button", { name: "Se connecter" }).click();
      // Scoped to the form: Next renders its own `role="alert"` route announcer
      // on every page, so a bare role query matches two elements.
      const alert = page.locator("form [role=alert]");
      await expect(alert).toBeVisible();
      return (await alert.textContent())?.trim();
    };

    const wrongPassword = await attempt(email as string, "ce-nest-pas-le-bon");
    const unknownAddress = await attempt("personne-ici@belso.ma", "ce-nest-pas-le-bon");

    /*
     * Identical strings, not merely both-are-errors. Any difference at all —
     * a different sentence, a field-level message under the email box — tells
     * whoever is asking which addresses have accounts, which for a
     * three-person agency is most of the answer.
     */
    expect(unknownAddress).toBe(wrongPassword);
    await shot(page, "51-admin-sign-in-refused");
  });

  test("@cuj AC-1: signing in reaches the back-office, and signing out closes it again", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);

    await page.getByLabel("Adresse e-mail").fill(email as string);
    await page.getByLabel("Mot de passe").fill(password as string);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    await shot(page, "52-admin-signed-in");

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion/);

    // And the session is genuinely gone, not merely navigated away from.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });
});
