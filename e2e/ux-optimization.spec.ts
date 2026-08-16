import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("geoptimaliseerde werkflow blijft compact en contextvast", async ({
  page,
}) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  const importDialog = page.getByRole("dialog", {
    name: "JSON-gegevensbestand",
  })
  await importDialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/json/small-valid.json"),
    )
  await importDialog.getByRole("button", { name: "Bestand openen" }).click()

  await expect(page.getByRole("heading", { name: "Mijn werk" })).toBeVisible()
  await page.screenshot({
    path: "test-results/ux-dashboard.png",
    fullPage: true,
  })

  await page.getByRole("button", { name: "+ Nieuw" }).click()
  await expect(
    page.getByRole("menuitem", { name: /Nieuw projectdossier/ }),
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await expect(page.getByLabel("Status")).toHaveCount(0)
  await page.getByRole("button", { name: "Zonder cluster" }).click()
  await expect(
    page.getByRole("button", { name: "Zonder cluster verwijderen" }),
  ).toBeVisible()
  await page.getByRole("button", { name: /Filters \(1\)/ }).click()
  await expect(page.getByLabel("Status")).toBeVisible()
  await page.screenshot({
    path: "test-results/ux-portfolio.png",
    fullPage: true,
  })

  await page.locator(".portfolio-row--project").first().click()
  await page.getByRole("button", { name: "Snel bijwerken" }).click()
  await expect(
    page.getByRole("heading", { name: "Kerngegevens snel bijwerken" }),
  ).toBeVisible()
  await expect(page.getByLabel("Voortgang (%)")).toBeVisible()
  await page.screenshot({
    path: "test-results/ux-project-quick-edit.png",
    fullPage: true,
  })
})
