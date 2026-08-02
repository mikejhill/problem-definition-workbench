import { expect, test } from "@playwright/test";

test("authors and exports a local problem definition", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/problem-definition-workbench/#new");
  await page.waitForLoadState("networkidle");
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole("heading", { name: "Untitled Problem Definition" })).toBeVisible();

  if ((page.viewportSize()?.width ?? 1_000) <= 880) {
    await page.getByRole("button", { name: "Outline", exact: true }).click();
  }
  await page.getByRole("button", { name: /Problem Statement/ }).click();
  const editor = page.getByLabel("Problem statement");
  await editor.fill("Residents cannot reliably borrow infrequently used tools.");
  await editor.blur();

  if ((page.viewportSize()?.width ?? 1_000) <= 880) {
    await page.getByRole("button", { name: /Review & Output/ }).click();
  }
  await page.getByRole("tab", { name: "Output" }).click();
  await expect(page.getByRole("heading", { name: "Working Prompt" })).toBeVisible();
  await expect(page.locator("pre.output-preview")).toContainText(
    "Residents cannot reliably borrow",
  );
});
