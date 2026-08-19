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
      document.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--in-cta") ===
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
  await scrollTo(page, 1350);
  await expect(page.getByRole("heading", { name: "About Belso" })).toBeVisible();
  await expect(page.getByText("A quieter kind of address")).toBeVisible();
  await shot(page, "02-about", { fullPage: false });

  // Past the runway the page is ordinary content. Each section below is a door
  // to a real page rather than a scroll position, which is the whole point of
  // the rework — so each is asserted by its heading and its link.
  const residences = page.locator("#residences");
  await scrollToSection(page, "residences");
  await expect(page.getByRole("heading", { name: "The selection", exact: true })).toBeVisible();
  // The shelf is one row drawn from the real catalogue, not fixture cards that
  // only exist on this page.
  // Cards specifically: the section also carries the neighbourhood strip, so
  // counting list items that contain a link now counts both lists.
  await expect(residences.locator("article")).toHaveCount(3);
  await expect(residences.getByRole("navigation")).toBeVisible();
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

/*
 * The wordmark and the lede beneath it are positioned from opposite edges: the
 * wordmark's bottom is a function of the viewport *width* (15vh down, then 19vw
 * of type), while the lede hangs off the viewport *bottom*. Nothing tied them
 * together, so the clearance between them was luck — one pixel at 1440x900, and
 * a 75px overlap on a 1900x950 laptop, with the lede printed through "BELSO".
 *
 * Checked at the aspect ratios where the two edges converge: wide-and-short is
 * the failure case, not small.
 */
for (const [width, height] of [
  [1920, 1080],
  [1900, 950],
  [1440, 800],
  [1366, 768],
  [1280, 720],
] as const) {
  test(`the hero lede clears the wordmark at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/en");

    // The splash translates the wordmark 30px down while it fades in, so a
    // measurement taken on load reads a layout no one ever sees at rest — it
    // reported a 4px overlap here where the settled frame has 25px of air.
    await page.waitForFunction(
      (selector) =>
        document.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--in-cta") ===
        "1.0000",
      SCENE,
      { timeout: 15_000 },
    );

    const wordmark = page.getByRole("heading", { level: 1, name: "Belso" });
    const lede = page.getByRole("heading", { level: 2, name: /Where heritage meets home/i });
    await expect(wordmark).toBeVisible();

    const [mark, line] = await Promise.all([wordmark.boundingBox(), lede.boundingBox()]);
    if (!mark || !line) throw new Error("hero headings are not laid out");

    const overlapsHorizontally =
      Math.min(mark.x + mark.width, line.x + line.width) - Math.max(mark.x, line.x) > 0;
    expect(overlapsHorizontally, "the two headings no longer share a column").toBe(true);

    const clearance = Math.round(line.y - (mark.y + mark.height));
    expect(clearance, `the lede overlaps the wordmark by ${-clearance}px`).toBeGreaterThan(0);
  });
}

/*
 * The scene pins the stage for the whole runway, so scroll that maps to no
 * change is scroll where the page flatly does not respond — you turn the wheel
 * and nothing happens. It shipped with 1300px of 2400 dead: 400px before the
 * first beat started and 900px after the last one finished, 54% of the scene.
 *
 * `reducedMotion` makes the scroll position map straight to the scene state
 * with no lerp, so each sample is exactly what that offset renders.
 */
test.describe("the cinematic scene", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("every part of the runway drives motion", async ({ page }) => {
    await page.goto("/en");

    const MOTION_VARS = [
      "--about-y",
      "--about-opacity",
      "--hero-recede",
      "--title-y",
      "--title-opacity",
      "--intro-copy-y",
      "--intro-copy-opacity",
    ];
    const STEP = 25;

    const runway = await page
      .locator(SCENE)
      .evaluate((el) => (el as HTMLElement).offsetHeight - window.innerHeight);

    const states: string[] = [];
    for (let y = 0; y <= runway; y += STEP) {
      states.push(
        await page.evaluate(
          ([offset, selector, vars]) => {
            window.scrollTo({ top: offset as number, behavior: "instant" });
            return new Promise<string>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const el = document.querySelector<HTMLElement>(selector as string);
                  resolve((vars as string[]).map((v) => el?.style.getPropertyValue(v)).join("|"));
                }),
              );
            });
          },
          [y, SCENE, MOTION_VARS] as const,
        ),
      );
    }

    let frozen = 0;
    for (let i = 1; i < states.length; i++) if (states[i] === states[i - 1]) frozen += STEP;

    // The only hold left is the ~100px at the end, long enough to read the
    // about sheet at rest before the stage releases.
    expect(frozen, `${frozen}px of the ${runway}px runway renders no change`).toBeLessThanOrEqual(
      200,
    );
  });
});

/*
 * The header holds four links, a wordmark and the language switcher. In one row
 * that needs about 420px of the 336px a 390px phone actually offers, so it used
 * to fail twice over: "À propos" broke onto two lines, and the switcher was
 * pushed past the right edge — to x=447 in a 390px viewport, clipped rather
 * than scrollable. On any phone at or below 414px the language could not be
 * changed at all, which is AC-1 failing on the commonest screen we have.
 *
 * Below 640px it now wraps to two lines by design. This measures both header
 * modes — over the scene, where it is fixed chrome, and on an ordinary page,
 * where it is a solid bar with different padding.
 */
for (const path of ["/fr", "/fr/biens"] as const) {
  for (const width of [320, 360, 390, 414, 480] as const) {
    test(`the header fits ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);

      const measured = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return null;

        /*
         * Selected by label, never by position. These were `navs[0]` and
         * `navs.at(-1)` until the language switcher moved from beside the
         * contact button to beside the wordmark — which silently swapped what
         * both of them pointed at, so the sweep went on passing while measuring
         * the menu against the switcher's own bounds.
         */
        const menu = header.querySelector('nav[aria-label="Menu principal"]');
        const switcher = header.querySelector('nav[aria-label="Langue"]');
        // The contact button is the last link in the header and sits furthest
        // right, so it is the first thing to fall off a narrow screen.
        const cta = [...header.querySelectorAll("a")].at(-1);
        if (!menu || !switcher || !cta) return null;

        const links = [...menu.querySelectorAll("a")].map((a) => a.getBoundingClientRect());
        return {
          linkHeight: Math.max(...links.map((r) => r.height)),
          navRight: Math.max(...links.map((r) => r.right)),
          switcherRight: switcher.getBoundingClientRect().right,
          ctaRight: cta.getBoundingClientRect().right,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(measured).not.toBeNull();
      const { linkHeight, navRight, switcherRight, ctaRight, overflow } = measured!;

      // A single line of 17px type. Two lines measure 34.
      expect(linkHeight, "a navigation label wrapped onto a second line").toBeLessThan(20);
      expect(
        navRight,
        `the navigation runs ${navRight - width}px past the right edge`,
      ).toBeLessThanOrEqual(width);
      expect(
        switcherRight,
        `the language switcher is ${switcherRight - width}px off-screen and unreachable`,
      ).toBeLessThanOrEqual(width);
      expect(
        ctaRight,
        `the contact button is ${ctaRight - width}px off-screen and unreachable`,
      ).toBeLessThanOrEqual(width);
      expect(overflow, "the page scrolls sideways").toBe(0);
    });
  }
}

/*
 * The header is one object, and it must not change size or position when the
 * scene ends.
 *
 * It used to. Over the film it is inset to the framed world and padded inside
 * that; on an ordinary page it was `mx-auto max-w-7xl px-6` and a little
 * taller. Leaving the scene therefore moved the wordmark 26px inboard on a
 * 1440px screen — and 258px on a 1920px one, where the whole chrome visibly
 * jumped toward the middle and grew 8px at the same moment.
 *
 * Compared rather than pinned to numbers: the geometry is free to change, the
 * two modes are not free to disagree about it.
 */
for (const width of [390, 1024, 1440, 1920] as const) {
  test(`the header is the same size on and off the scene at ${width}px`, async ({ page }) => {
    const geometry = async (path: string) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      return page.evaluate(() => {
        const header = document.querySelector("header")!;
        const row = header.querySelector("div.flex")!;
        const wordmark = header.querySelector("a[href^='/fr'], a[href^='/en']")!;
        const cta = [...header.querySelectorAll("a")].at(-1)!;
        return {
          height: Math.round(row.getBoundingClientRect().height),
          wordmarkLeft: Math.round(wordmark.getBoundingClientRect().left),
          ctaRight: Math.round(cta.getBoundingClientRect().right),
        };
      });
    };

    const onScene = await geometry("/fr");
    const onPage = await geometry("/fr/biens");

    expect(onPage.height, "the header changes height when the scene ends").toBe(onScene.height);
    expect(onPage.wordmarkLeft, "the wordmark moves when the scene ends").toBe(
      onScene.wordmarkLeft,
    );
    expect(onPage.ctaRight, "the contact button moves when the scene ends").toBe(onScene.ctaRight);
  });
}

/*
 * The header and the footer bracket the page, so they cannot disagree about
 * where its edges are. They did: the header aligned to the scene's frame while
 * the footer sat in a 1280px column, which on the full-bleed listings grid put
 * them 282px apart at 1920px.
 */
for (const width of [390, 1440, 1920] as const) {
  test(`the header and footer start at the same edge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/fr/biens");

    const edges = await page.evaluate(() => {
      const inner = (root: Element | null) => {
        const el = root?.querySelector(".container-bleed, .container-page");
        if (!el) return null;
        return Math.round(
          el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft),
        );
      };
      const header = document.querySelector("header");
      const headerRow = header?.querySelector("div.flex");
      return {
        header: headerRow
          ? Math.round(
              headerRow.getBoundingClientRect().left +
                parseFloat(getComputedStyle(headerRow).paddingLeft),
            )
          : null,
        footer: inner(document.querySelector("footer")),
      };
    });

    expect(edges.header).not.toBeNull();
    expect(edges.footer, "the footer starts at a different edge than the header").toBe(
      edges.header,
    );
  });
}
