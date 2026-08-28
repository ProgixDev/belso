import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * AC-5 — the catalogue when the database does not answer.
 *
 * **This spec only means anything with Postgres actually stopped**, which no
 * other spec wants and which cannot be arranged from inside Playwright: the
 * database lives on the VPS, and stopping it is a `docker stop`. So it is
 * skipped unless `DB_DOWN=1` says a human (or `pnpm verify:db:down`) has
 * arranged it — a test that silently passes because the thing it tests was
 * never set up is worse than no test.
 *
 * It is excluded from the default run for the same reason: `pnpm e2e` must not
 * depend on someone having broken the database first.
 *
 * The distinction being defended: an empty catalogue and an unreachable one
 * look identical to a visitor and mean opposite things. "Nothing matched your
 * search" reads as *this agency has nothing for sale*, which is the worst
 * possible lie for a business whose entire proposition is its inventory.
 */
test.skip(process.env.DB_DOWN !== "1", "requires the database to be stopped (DB_DOWN=1)");

test("AC-5: the catalogue says the listings cannot be loaded, and says nothing false", async ({
  page,
}) => {
  const response = await page.goto("/fr/biens");

  // Not a stack trace, and not a crash the browser renders as its own error.
  expect(response?.status()).toBe(200);

  await expect(page.getByText(/ne se chargent pas/)).toBeVisible();

  // The critical negative: it must not have fallen back to "no results". A
  // visitor cannot tell those apart, and one of them is a lie about the client.
  await expect(page.getByText(/Aucun bien/)).toHaveCount(0);
  await expect(page.locator("main ul > li article")).toHaveCount(0);

  await shot(page, "40-catalogue-database-down");
});

test("AC-5: the rest of the site is unaffected", async ({ page }) => {
  /*
   * The home page and the neighbourhoods **do** read the catalogue — since the
   * review board they render per request rather than from a build-time
   * snapshot, so they genuinely reach the database and must degrade rather than
   * fall over. About and contact do not read it and must be untouched.
   */
  const paths = [
    ["/fr", "41-home"],
    ["/fr/a-propos", "43-about"],
    ["/fr/contact", "44-contact"],
    ["/fr/quartiers", "45-neighbourhoods"],
  ] as const;

  for (const [path, name] of paths) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should still serve`).toBe(200);

    // Not `h1` — the bare global-error page has one of those too, which is
    // exactly how a missing error boundary on the home page went unnoticed for
    // as long as it did. The site's own chrome is what distinguishes "still
    // working" from "fell over".
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();

    // One shot per path, inside the loop. Taken after it, every file was the
    // last path — so `41-home-database-down.png` was a picture of
    // `/fr/quartiers`, and no evidence of the home page in this state existed.
    // Which is how the home page's missing error boundary stayed invisible.
    await shot(page, `${name}-database-down`);
  }
});

test("AC-5: a visitor is not told their message was sent when it was not", async ({ page }) => {
  await page.goto("/fr/contact");

  await page.getByLabel(/nom/i).first().fill("Camille Rey");
  await page
    .getByLabel(/e-?mail/i)
    .first()
    .fill("camille@example.com");
  await page
    .getByLabel(/message/i)
    .first()
    .fill("Bonjour, je souhaite des informations sur vos biens à la Palmeraie.");
  await page.getByRole("button", { name: /envoyer/i }).click();

  /*
   * The enquiry cannot be stored, so the one thing that must not appear is a
   * confirmation. A visitor who believes an agent has their message stops
   * chasing, and nobody ever learns the enquiry existed — the failure is
   * silent, permanent, and costs exactly the thing the site is for.
   */
  await expect(page.getByText(/n’a pas pu être envoyée|déjà envoyé/)).toBeVisible();
  await shot(page, "42-enquiry-database-down");
});
