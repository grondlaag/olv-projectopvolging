import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("P2 persoonlijke werkruimte en contextacties", async ({ page }) => {
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

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.locator(".portfolio-row--project").first().click()
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()

  await page.keyboard.press("?")
  await expect(page.getByRole("dialog", { name: "Sneltoetsen" })).toBeVisible()
  await page.getByRole("button", { name: "Sneltoetsen sluiten" }).click()
  await page.keyboard.press("n")
  const createMenu = page.getByRole("menu")
  await expect(
    createMenu.getByRole("menuitem", { name: /Topic in dit project/ }),
  ).toBeVisible()
  await createMenu
    .getByRole("menuitem", { name: /Actie bij dit project/ })
    .click()

  const actionPanel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await actionPanel.getByLabel("Titel").fill("P2 contextactie")
  await actionPanel.getByLabel("Eigenaar").selectOption({ index: 1 })
  await actionPanel.getByRole("button", { name: "Actie opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Projectacties" }).click()
  await page.getByRole("button", { name: "Als favoriet" }).click()
  await expect(page.getByText("Snel bereikbaar")).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Acties" })
    .click()
  await expect(
    page.getByRole("button", { name: /P2 contextactie/ }),
  ).toBeVisible()

  await page
    .getByRole("region", { name: "Filters" })
    .getByText("Filters", { exact: true })
    .click()
  await page.getByRole("button", { name: "+ Weergave bewaren" }).click()
  await page.getByLabel("Naam van weergave").fill("P2 actieweergave")
  await page.getByRole("button", { name: "Bewaren" }).click()
  await expect(page.getByLabel("Opgeslagen weergave")).toContainText(
    "P2 actieweergave",
  )

  await page.getByRole("button", { name: "Tabelweergave" }).click()
  const tableDialog = page.getByRole("dialog", {
    name: "Tabelweergave instellen",
  })
  await page.screenshot({
    path: "test-results/p2-table-dialog.png",
    fullPage: true,
  })
  await tableDialog.getByRole("radio", { name: "Compact" }).check()
  await tableDialog.getByRole("checkbox", { name: "Topic" }).uncheck()
  await tableDialog.getByRole("button", { name: "Sluiten" }).click()
  await expect(page.getByRole("table")).toHaveAttribute(
    "data-density",
    "compact",
  )

  await page.getByLabel("Selecteer P2 contextactie").check()
  const bulk = page.getByRole("region", { name: "Bulkacties" })
  await bulk.getByLabel("Status").selectOption("Geannuleerd")
  await bulk.getByRole("button", { name: "Wijziging toepassen" }).click()
  await expect(
    page.getByText("1 acties bijgewerkt · back-up nodig"),
  ).toBeVisible()

  await page.screenshot({
    path: "test-results/p2-personal-workspace.png",
    fullPage: true,
  })
})
