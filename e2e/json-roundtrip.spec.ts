import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("de productie-interface bewaart een JSON-roundtrip", async ({ page }) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  let dialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/json/small-valid.json"),
    )
  await expect(dialog.getByText("Blocking: 0")).toBeVisible()
  await dialog.getByRole("button", { name: "Bestand openen" }).click()
  await expect(
    page.getByText(/Actuele signalen uit small-valid\.json/),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/json-roundtrip.json",
  )
  await download.saveAs(exportedPath)

  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await dialog.locator('input[type="file"]').setInputFiles(exportedPath)
  await expect(dialog.getByText("Blocking: 0")).toBeVisible()
  await dialog.getByRole("button", { name: "Bestand openen" }).click()
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(
    page.getByText("Synthetisch renovatieproject").first(),
  ).toBeVisible()
})
