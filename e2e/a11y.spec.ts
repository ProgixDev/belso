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

/*
 * The contact button is the only filled control that sits on the film, and both
 * its fill and its label are mixed from the scene's tint. Blending both ends of
 * a pair against each other is a trap: the fill travels cream → ink while the
 * label travels ink → cream, so they cross, and at the midpoint they are the
 * same colour — a solid pill with no label in it. It shipped that way for about
 * an hour: 1.00:1 at t=0.5, under 4.5:1 for half the transition, and invisible
 * on any scroll that stalled in the middle.
 *
 * Forced across the tint's whole range rather than sampled by scrolling. A
 * scroll sweep found only three frames in transition and all of them passed,
 * which is luck: the smoothing eases through every intermediate value on every
 * crossing, so the range is the thing to assert.
 */
test("AC-11: the contact button's label survives every value of the scene tint", async ({
  page,
}) => {
  await page.goto("/fr");
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "Contact" })).toBeVisible();

  const measured = await page.evaluate(() => {
    /*
     * Painted into a 1x1 canvas and read back. `ctx.fillStyle` does not
     * normalise `oklab()` to hex in current Chrome, and a numeric parse of
     * "oklab(0.23 0.008 0.014)" reads it as RGB and reports every pair at ~1:1.
     */
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const channels = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r! / 255, g! / 255, b! / 255];
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };

    const cta = [...document.querySelectorAll("header a")].at(-1)!;
    const results: { tint: number; ratio: number }[] = [];

    for (let tint = 0; tint <= 1.0001; tint += 0.05) {
      document.documentElement.style.setProperty("--chrome-on-light", tint.toFixed(4));
      const style = getComputedStyle(cta);
      const a = luminance(channels(style.color));
      const b = luminance(channels(style.backgroundColor));
      const [hi, lo] = a > b ? [a, b] : [b, a];
      results.push({ tint: Number(tint.toFixed(2)), ratio: (hi + 0.05) / (lo + 0.05) });
    }
    document.documentElement.style.removeProperty("--chrome-on-light");
    return results;
  });

  for (const { tint, ratio } of measured) {
    expect(ratio, `label on fill is ${ratio.toFixed(2)}:1 at tint ${tint}`).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

/*
 * The footer sets ink type on a photograph, so its contrast is a property of
 * the *crop*, not of a colour pair — and `object-cover` answers a wide short
 * box and a tall narrow one with completely different slices of the same
 * plate. The veil over it was chosen by sweeping viewports for exactly that
 * reason (45% left four failures, 50% one, 55% cleared).
 *
 * Which means any change to the footer's height re-crops it. Making it smaller
 * moved every run onto different sky; this is what says whether that was safe.
 */
test("AC-11: every line in the footer clears AA on the sky behind it", async ({ page }) => {
  const failures: string[] = [];

  for (const [width, height] of [
    [390, 844],
    [768, 900],
    [1280, 900],
    [1920, 1000],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/fr/biens");

    // The reveals must have run: an unrevealed run is measured where it is not.
    await page.evaluate(async () => {
      const settle = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.75) {
        window.scrollTo({ top: y, behavior: "instant" });
        await settle();
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      await settle();
    });
    await page.waitForTimeout(500);

    // Glyphs out, ground only — then the worst pixel under each run.
    const runs = await page.evaluate(() => {
      const footer = document.querySelector("footer")!;
      const box = footer.getBoundingClientRect();
      const nodes = [...footer.querySelectorAll("p,a,h2")].filter((el) => el.textContent?.trim());
      const measured = nodes.map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          text: el.textContent!.trim().slice(0, 24),
          color: style.color,
          size: parseFloat(style.fontSize),
          weight: Number(style.fontWeight),
          x: Math.round(rect.left - box.left),
          y: Math.round(rect.top - box.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      });
      nodes.forEach((el) => {
        (el as HTMLElement).style.color = "transparent";
      });
      return measured;
    });

    const png = (await page.locator("footer").screenshot()).toString("base64");

    const results = await page.evaluate(
      async ({ png, runs }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);

        const luminance = (r: number, g: number, b: number) => {
          const [lr, lg, lb] = [r, g, b].map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
        };
        const inkLuminance = (css: string) => {
          const probe = document.createElement("canvas");
          probe.width = probe.height = 1;
          const c = probe.getContext("2d", { willReadFrequently: true })!;
          c.fillStyle = css;
          c.fillRect(0, 0, 1, 1);
          const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
          return luminance(r!, g!, b!);
        };

        return runs.flatMap((run) => {
          const x = Math.max(0, run.x);
          const y = Math.max(0, run.y);
          const w = Math.min(run.w, canvas.width - x);
          const h = Math.min(run.h, canvas.height - y);
          if (w < 2 || h < 2) return [];

          const data = ctx.getImageData(x, y, w, h).data;
          const ink = inkLuminance(run.color);
          let worst = Infinity;
          for (let i = 0; i < data.length; i += 4) {
            const ground = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
            const [hi, lo] = ink > ground ? [ink, ground] : [ground, ink];
            worst = Math.min(worst, (hi + 0.05) / (lo + 0.05));
          }
          // WCAG "large text": 24px, or 18.66px when bold.
          const large = run.size >= 24 || (run.size >= 18.66 && run.weight >= 700);
          return [{ text: run.text, ratio: worst, needs: large ? 3 : 4.5 }];
        });
      },
      { png, runs },
    );

    expect(results.length, `nothing measured at ${width}px`).toBeGreaterThan(5);
    for (const { text, ratio, needs } of results) {
      if (ratio < needs) {
        failures.push(`${width}px "${text}" ${ratio.toFixed(2)}:1 (needs ${needs}:1)`);
      }
    }
  }

  expect(failures, failures.join("; ")).toEqual([]);
});
