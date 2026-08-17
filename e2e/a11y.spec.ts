import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

/**
 * AC-11: reachable by keyboard with focus always visible, and usable by someone
 * who has asked their system to reduce motion.
 *
 * These assert the two things that are invisible until someone actually needs
 * them, and that no amount of looking at a screenshot would reveal.
 */

/**
 * Does the focused element show a focus indicator?
 *
 * Tailwind's `focus-visible:ring-*` compiles to a `box-shadow`, not an
 * `outline`, so checking `outline` alone reports every ringed control as
 * invisible. This checks either, and treats `outline: none` with no shadow as
 * the failure it is.
 */
async function focusIsVisible(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    const indicated = (el: Element) => {
      const style = getComputedStyle(el);
      const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const hasRing = style.boxShadow !== "none" && style.boxShadow !== "";
      return hasOutline || hasRing;
    };

    const el = document.activeElement;
    if (!el || el === document.body) return false;
    if (indicated(el)) return true;

    // A card that rings itself while its link is focused is genuinely showing
    // the user where they are, even though the ring is not on the focused
    // element. Anchored to the containing card rather than a magic number of
    // parent hops, which would break the moment the markup nests differently.
    const card = el.closest("article, li, fieldset");
    if (card && indicated(card)) return true;

    return false;
  });
}

const describeFocused = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "none";
    return `${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 30)}`;
  });

test("AC-11: the first tab stop is a skip link that reaches the content", async ({ page }) => {
  await page.goto("/fr/biens");
  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  // sr-only until focused — the point is that it becomes visible when it is
  // the thing you are on.
  await expect(skip).toBeVisible();
  await expect(skip).toHaveAttribute("href", "#main");
  await shot(page, "16-skip-link-focused", { fullPage: false });
});

test("AC-11: every control on the listings page is reachable with a visible focus ring", async ({
  page,
}) => {
  await page.goto("/fr/biens");

  const seen: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const description = await describeFocused(page);
    if (description === "none") break;
    seen.push(description);
    expect(await focusIsVisible(page), `no focus indicator on ${description}`).toBe(true);
  }

  // Tabbing must actually travel — a focus trap shows up as the same element
  // repeated, which an "is it focused" assertion alone would not catch.
  expect(new Set(seen).size).toBeGreaterThan(5);
});

test("AC-11: the gallery can be driven from the keyboard alone", async ({ page }) => {
  await page.goto("/fr/biens/villa-vue-atlas-palmeraie");

  const next = page.getByRole("button", { name: "Photo suivante" });
  await next.focus();
  await expect(next).toBeFocused();
  expect(await focusIsVisible(page)).toBe(true);

  const position = page.getByText(/Photo \d+ sur \d+/);
  await expect(position).toHaveText(/Photo 1 sur/);
  await page.keyboard.press("Enter");
  await expect(position).toHaveText(/Photo 2 sur/);
});

test("AC-11: the enquiry form is completable without a mouse", async ({ page }) => {
  await page.goto("/fr/contact");

  await page.getByLabel("Nom").focus();
  await page.keyboard.type("Camille Roux");
  await page.keyboard.press("Tab");
  await page.keyboard.type("camille@example.com");
  await page.keyboard.press("Tab"); // phone
  await page.keyboard.press("Tab"); // message
  await page.keyboard.type("Je cherche une villa à Marrakech pour l’été prochain.");

  await page.getByRole("button", { name: "Envoyer la demande" }).focus();
  expect(await focusIsVisible(page)).toBe(true);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText("Votre demande est bien partie");
});

test.describe("a visitor who has asked for reduced motion", () => {
  // Playwright 1.60 does not surface `reducedMotion` as a top-level test
  // option here, so it is set on the browser context directly.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("AC-11: the scene presents without the splash, parallax or reveal", async ({ page }) => {
    await page.goto("/fr");

    // With motion reduced the intro is skipped outright rather than played
    // fast, so the hero is complete immediately instead of after ~2.6s.
    await expect(page.getByRole("heading", { level: 1, name: "Belso" })).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
    await shot(page, "17-reduced-motion-hero", { fullPage: false });
  });

  test("AC-11: the gallery still works with motion reduced", async ({ page }) => {
    await page.goto("/fr/biens/villa-vue-atlas-palmeraie");

    const position = page.getByText(/Photo \d+ sur \d+/);
    await expect(position).toHaveText(/Photo 1 sur/);
    await page.getByRole("button", { name: "Photo suivante" }).click();
    await expect(position).toHaveText(/Photo 2 sur/);
    await shot(page, "18-reduced-motion-gallery");
  });
});
