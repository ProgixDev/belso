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

/*
 * Scroll reveals and the page transition both start hidden, and both start
 * states are server-rendered. Without a `<noscript>` override the whole site is
 * blank to anyone whose JavaScript did not run — which is not only a browser
 * setting: it is also a failed chunk, a blocked CDN, or a slow connection that
 * gave up.
 *
 * This shipped broken once already. The reveals carried the guard; the page
 * transition, added later, did not, and every content page rendered empty.
 */
test.describe("a visitor whose JavaScript never ran", () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, heading] of [
    [
      "/en/about",
      "A private address in the Palmeraie, drawn for the way Marrakech actually lives.",
    ],
    ["/en/contact", "Contact us"],
  ] as const) {
    test(`AC-11: ${path} still renders its content`, async ({ page }) => {
      await page.goto(path);

      const title = page.getByRole("heading", { level: 1, name: heading });
      await expect(title).toBeVisible();
      // `toBeVisible` passes on a fully transparent element, so the thing that
      // actually broke has to be asserted directly.
      await expect(title).toHaveCSS("opacity", "1");
    });
  }

  test("AC-11: the hero search still submits without JavaScript", async ({ page }) => {
    await page.goto("/en");

    // A plain GET form, which is why it survives: the visitor's words go into
    // the URL and the listings page reads them server-side.
    await page.getByRole("searchbox").fill("riad medina");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/en\/properties\?q=riad\+medina/);

    // Deliberately not asserting the results here. `properties/(index)` ships a
    // `loading.tsx`, and a streamed Suspense fallback is swapped for the real
    // content by an inline script — with no JavaScript that swap never happens,
    // so this route renders its skeleton and stops. That is a property of
    // streaming, not of this form, and it is recorded in the feature doc.
  });
});
