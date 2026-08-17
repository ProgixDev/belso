import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * The second half of CUJ-03 — sending an enquiry — plus the states around it.
 *
 * The form is a painted door: it validates like the real thing and stores
 * nothing (docs/process/painted-door.md). These tests assert what the visitor
 * sees, which is all the painted door promises.
 */

test("@cuj CUJ-03: the enquiry form already knows which property it is about", async ({ page }) => {
  await page.goto("/fr/biens/villa-vue-atlas-palmeraie");

  // AC-6: the reference is quoted without the visitor typing it.
  await expect(page.getByText(/BL-1101/).first()).toBeVisible();

  await page.getByLabel("Nom").fill("Camille Roux");
  await page.getByLabel("E-mail").fill("camille@example.com");
  await page.getByLabel("Message").fill("Je souhaite visiter cette villa le mois prochain.");
  await shot(page, "10-enquiry-filled");

  await page.getByRole("button", { name: "Envoyer la demande" }).click();

  // The confirmation names the property back. Scoped to the confirmation
  // region — the page heading carries the same words.
  const confirmation = page.getByRole("status");
  await expect(confirmation).toContainText("Votre demande est bien partie");
  await expect(confirmation).toContainText("Villa vue Atlas, Palmeraie");
  await shot(page, "11-enquiry-confirmed");
});

test("AC-7: a bad email is explained in place and nothing typed is lost", async ({ page }) => {
  await page.goto("/fr/biens/villa-vue-atlas-palmeraie");

  await page.getByLabel("Nom").fill("Camille Roux");
  await page.getByLabel("E-mail").fill("camille@example");
  await page.getByLabel("Téléphone (facultatif)").fill("+212 600 000 000");
  await page.getByLabel("Message").fill("Je souhaite visiter cette villa le mois prochain.");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();

  // The problem is named next to the field, in the language of the page.
  const emailError = page.getByText("Indiquez une adresse e-mail valide.");
  await expect(emailError).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");

  // No confirmation.
  await expect(page.getByText("Votre demande est bien partie")).toBeHidden();

  // And everything else survives — the regression that makes a form infuriating.
  await expect(page.getByLabel("Nom")).toHaveValue("Camille Roux");
  await expect(page.getByLabel("Téléphone (facultatif)")).toHaveValue("+212 600 000 000");
  await expect(page.getByLabel("Message")).toHaveValue(
    "Je souhaite visiter cette villa le mois prochain.",
  );
  await shot(page, "12-enquiry-invalid-email");
});

test("AC-6: the contact page sends without a property attached", async ({ page }) => {
  await page.goto("/fr/contact");

  await page.getByLabel("Nom").fill("Camille Roux");
  await page.getByLabel("E-mail").fill("camille@example.com");
  await page.getByLabel("Message").fill("J’aimerais discuter d’un projet d’achat à Marrakech.");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();

  const confirmation = page.getByRole("status");
  await expect(confirmation).toContainText("Votre demande est bien partie");
  // With no property to name, the confirmation uses the general wording rather
  // than a sentence with a hole in it.
  await expect(confirmation).toContainText("Nous revenons vers vous sous 24 heures.");
  await shot(page, "13-contact-confirmed");
});

test("AC-10: every header and footer link resolves, in both languages", async ({ page }) => {
  for (const start of ["/fr/biens", "/en/properties"]) {
    await page.goto(start);

    const hrefs = await page
      .locator("header a[href], footer a[href]")
      .evaluateAll((links) =>
        links
          .map((a) => a.getAttribute("href"))
          .filter((h): h is string => h !== null && h !== "" && !h.startsWith("#")),
      );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of new Set(hrefs)) {
      const response = await page.request.get(href);
      // A dead link in the chrome is on every page at once, which is why this
      // crawls rather than spot-checks.
      expect(response.status(), `${start} → ${href}`).toBe(200);
    }
  }
});

test("AC-10: the legal documents are reachable and structured, not blank", async ({ page }) => {
  await page.goto("/fr/legal/privacy");

  await expect(page.getByRole("heading", { level: 1, name: "Confidentialité" })).toBeVisible();
  // The copy is a placeholder, but the GDPR-expected sections are already here
  // and say plainly that the text is being written.
  await expect(page.getByRole("heading", { name: "Vos droits" })).toBeVisible();
  await expect(page.getByRole("note")).toBeVisible();
  await shot(page, "14-legal-privacy");
});

test("AC-8: an unknown legal document is a 404, not an empty page", async ({ page }) => {
  const response = await page.goto("/fr/legal/inconnu");

  expect(response?.status()).toBe(404);
});
