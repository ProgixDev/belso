import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

const SCENE = "#scene";

/**
 * The scene lerps toward the scroll target over ~2s, so a shot taken too early
 * catches a half-played frame. Wait until a motion variable has been unchanged
 * for 20 consecutive animation frames.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return false;
      const value = el.style.getPropertyValue("--about-y");
      if (!value) return false;
      const stable = el.dataset.settleValue === value ? Number(el.dataset.settleCount ?? 0) + 1 : 0;
      el.dataset.settleValue = value;
      el.dataset.settleCount = String(stable);
      return stable >= 20;
    },
    SCENE,
    { timeout: 30_000, polling: "raf" },
  );
}

async function scrollTo(page: import("@playwright/test").Page, y: number) {
  await page.evaluate(
    ([selector, top]) => {
      // Reset the stability counter, or the previous target's settled value
      // satisfies `settle` before this scroll has moved anything.
      const el = document.querySelector<HTMLElement>(String(selector));
      delete el?.dataset.settleValue;
      delete el?.dataset.settleCount;
      window.scrollTo({ top: Number(top), behavior: "instant" });
    },
    [SCENE, y] as const,
  );
  await settle(page);
}

/**
 * Scroll a section to the top of the viewport and wait until it has *arrived*.
 *
 * `scroll-behavior: smooth` is set globally, so `scrollIntoView` returns while
 * the page is still travelling — a screenshot taken straight after catches the
 * header a third of the way through its 500ms handover from scene chrome to
 * page chrome, which reads as a bug that is not there. Waits on the element's
 * own position holding still rather than on a duration.
 */
async function scrollToSection(page: import("@playwright/test").Page, id: string) {
  await page.evaluate((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView();
  }, id);

  await page.waitForFunction(
    (sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return false;
      const top = Math.round(el.getBoundingClientRect().top);
      const stable = el.dataset.restTop === String(top) ? Number(el.dataset.restCount ?? 0) + 1 : 0;
      el.dataset.restTop = String(top);
      el.dataset.restCount = String(stable);
      return stable >= 20;
    },
    id,
    { timeout: 15_000, polling: "raf" },
  );
}

// CUJ-01 — Land and travel the Belso story (docs/product/critical-user-journeys.md)
test("@cuj CUJ-01: visitor lands, watches the scene, and reaches the catalogue", async ({
  page,
}) => {
  await page.goto("/");

  // The splash intro staggers the chrome in over ~2.6s; wait for its last beat.
  await page.waitForFunction(
    (selector) =>
      document.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--in-note") ===
      "1.0000",
    SCENE,
    { timeout: 15_000 },
  );
  await expect(page.getByRole("heading", { level: 1, name: "Belso" })).toBeVisible();
  // The test browser announces en-US, so the proxy lands this visitor on /en
  // rather than the default French (AC-1). Asserted rather than assumed —
  // getting it wrong is how this test came to expect a French label on an
  // English page.
  await expect(page).toHaveURL(/\/en$/);
  // Spec 004 replaced the "Book a call" CTA with the search field that opens
  // the catalogue — the hero's one call to action (AC-2).
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await shot(page, "01-hero", { fullPage: false });

  // The scene's second and last beat. The section's heading is the masthead
  // ("About Belso"); the big line beneath it is a statement, not a second
  // heading — two headings would read as two sections to anything navigating
  // by structure.
  await scrollTo(page, 1500);
  await expect(page.getByRole("heading", { name: "About Belso" })).toBeVisible();
  await expect(page.getByText("A quieter kind of address")).toBeVisible();
  await shot(page, "02-about", { fullPage: false });

  // Past the runway the page is ordinary content. Each section below is a door
  // to a real page rather than a scroll position, which is the whole point of
  // the rework — so each is asserted by its heading and its link.
  const residences = page.locator("#residences");
  await scrollToSection(page, "residences");
  await expect(page.getByRole("heading", { name: "Properties", exact: true })).toBeVisible();
  // The shelf is one row drawn from the real catalogue, not fixture cards that
  // only exist on this page.
  await expect(
    residences.getByRole("listitem").filter({ has: page.getByRole("link") }),
  ).toHaveCount(3);
  await shot(page, "03-residences", { fullPage: false });

  await scrollToSection(page, "grounds");
  await expect(page.getByRole("heading", { name: "The grounds" })).toBeVisible();
  await expect(page.getByText("Everything close, nothing near")).toBeVisible();
  await shot(page, "04-grounds", { fullPage: false });

  await scrollToSection(page, "enquire");
  await expect(page.getByRole("heading", { name: "Write to us" })).toBeVisible();
  await shot(page, "05-enquire", { fullPage: false });

  // The journey ends where it is supposed to: in the catalogue.
  await residences.getByRole("link", { name: "Browse all properties" }).click();
  await expect(page).toHaveURL(/\/en\/properties$/);
  await shot(page, "06-catalogue", { fullPage: false });
});

test("AC-10: the header navigation is routes, not scroll positions", async ({ page }) => {
  await page.goto("/en");

  const header = page.getByRole("navigation", { name: "Main menu" });
  // Every entry must be an address — reachable, shareable, and meaningful from
  // any page. The scene's beats used to sit here as `#about`, `#residences` and
  // `#amenities`, which were none of those things.
  for (const href of await header
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))) {
    expect(href, `"${href}" is an in-page anchor, not a route`).not.toMatch(/^#/);
  }

  await header.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "07-about-page");
});

/*
 * The hero search is the site's primary action and its placeholder is the
 * instruction manual: it is the only thing telling a visitor they can type a
 * sentence rather than keywords. It shipped clipped at "Villa moderne à
 * Marraké" — 191px of field for 395px of sentence — and clipped again twice
 * while being fixed, because the field is sized by a chain of percentages and
 * every padding change moves it.
 *
 * So this measures rather than eyeballs, at the widths where the layout
 * changes shape: side by side above 640px, stacked below it.
 */
for (const [width, height] of [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
] as const) {
  test(`the hero search example is never clipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/fr");

    const input = page.getByRole("searchbox");
    await expect(input).toBeVisible();
    // The label is visible, not `sr-only` — the field's purpose cannot be left
    // to a placeholder that may itself be cut off.
    await expect(page.getByText("Décrivez le bien que vous cherchez")).toBeVisible();

    const headroom = await input.evaluate((el: HTMLInputElement) => {
      const style = getComputedStyle(el);
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing}`;
      probe.textContent = el.placeholder;
      document.body.append(probe);
      const needed = probe.getBoundingClientRect().width;
      probe.remove();
      const space =
        el.getBoundingClientRect().width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      return Math.round(space - needed);
    });

    expect(headroom, `placeholder overflows the field by ${-headroom}px`).toBeGreaterThan(0);
  });
}
