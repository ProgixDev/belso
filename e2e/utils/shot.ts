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

export async function shot(
  page: Page,
  name: string,
  /** Sticky/scroll-driven scenes need the viewport, not the whole 7000px runway. */
  options: { fullPage?: boolean } = {},
): Promise<void> {
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${name}.png`),
    fullPage: options.fullPage ?? true,
    animations: "disabled",
  });
}
