import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

// CUJ-01 — Land and orient (docs/product/critical-user-journeys.md)
test("@cuj CUJ-01: visitor lands, understands, reaches the example", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /a codebase that explains itself/i }),
  ).toBeVisible();
  await shot(page, "home-landing");

  await page.getByRole("link", { name: "Open the task list" }).click();
  await expect(page).toHaveURL(/\/examples\/tasks/);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});
