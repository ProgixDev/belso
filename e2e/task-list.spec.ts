import { expect, test } from "@playwright/test";
import { shot } from "./utils/shot";

// CUJ-02 — Manage tasks (specs/001-task-list — AC-1..AC-4)
test("@cuj CUJ-02: user adds, toggles, and clears tasks", async ({ page }) => {
  await page.goto("/examples/tasks");

  // Seeded state renders
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Skim docs/INDEX.md")).toBeVisible();
  await shot(page, "tasks-initial");

  // AC-1: add a task → it appears, input clears
  const input = page.getByLabel("New task title");
  await input.fill("Write the spec");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Write the spec")).toBeVisible();
  await expect(input).toHaveValue("");
  await shot(page, "tasks-added");

  // AC-2: toggle updates remaining count immediately
  await expect(page.getByText("3 remaining")).toBeVisible();
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.getByText("2 remaining")).toBeVisible();
  await shot(page, "tasks-toggled");

  // AC-3: blank submit adds nothing (native `required` blocks the form)
  const count = await page.getByRole("checkbox").count();
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(count);

  // AC-4: clear done removes only completed tasks, then disables itself
  const clearButton = page.getByRole("button", { name: "Clear done" });
  await expect(clearButton).toBeEnabled();
  await clearButton.click();
  await expect(page.getByText("Read AGENTS.md")).toBeHidden();
  await expect(page.getByText("Write the spec")).toBeVisible();
  await expect(clearButton).toBeDisabled();
  await shot(page, "tasks-cleared");
});
