import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/**
 * Screenshot evidence helper (docs/conventions/testing.md).
 * FEATURE=<slug> routes shots to artifacts/screenshots/<slug>/ — that's how
 * /verify-ui and /feature-report find a feature's evidence. Defaults to "baseline".
 * Names must be stable across runs so shots can be diffed release over release.
 */
const dir = join("artifacts", "screenshots", process.env.FEATURE ?? "baseline");

/**
 * Walk the page once so the scroll reveals have fired.
 *
 * Reveals animate on entering the viewport, so a full-page screenshot of a page
 * taller than the window captured everything below the fold at `opacity: 0`.
 * The evidence showed a heading over an empty space — a reviewer looking at it
 * would reasonably conclude the section was broken, and this is the repo's
 * primary way of verifying UI. It went unnoticed because the reveals were added
 * across the whole site in one change and nobody re-read the older shots.
 *
 * The scroll position is restored rather than reset: `shot` is called mid-test,
 * sometimes after the test has deliberately scrolled somewhere.
 */
async function fireReveals(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settle = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const startedAt = window.scrollY;
    const step = Math.max(1, window.innerHeight * 0.75);

    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await settle();
    }
    window.scrollTo({ top: startedAt, behavior: "instant" });
    await settle();
  });
  // `viewport.once` means they stay revealed; this is only to let the transition
  // start before `animations: "disabled"` jumps it to its end state.
  await page.waitForTimeout(120);
}

export async function shot(
  page: Page,
  name: string,
  /** Sticky/scroll-driven scenes need the viewport, not the whole 7000px runway. */
  options: { fullPage?: boolean } = {},
): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const fullPage = options.fullPage ?? true;

  // Only for full-page shots: on the landing page the scroll position *is* the
  // scene's state, and walking the runway to take a viewport shot would capture
  // a different frame than the test asked for.
  if (fullPage) await fireReveals(page);

  await page.screenshot({
    path: join(dir, `${name}.png`),
    fullPage,
    animations: "disabled",
  });
}
