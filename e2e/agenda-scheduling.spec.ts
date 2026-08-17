import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(120_000)

test("project en topic worden vanuit hun dossier op een overlegagenda geplaatst", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
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
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible()
  await importDialog.getByRole("button", { name: "Bestand openen" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg" })
    .click()
  await page.getByRole("button", { name: "+ Nieuw overleg" }).first().click()
  await page.getByLabel("Titel").fill("Projectoverleg agenda")
  await page.getByLabel("Datum").fill("2099-01-12")
  await page
    .locator('select[name="scopeId"]')
    .selectOption({ label: "PRJ-001 · Synthetisch renovatieproject" })
  await page.getByRole("button", { name: "Overleg opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Projectoverleg agenda" }),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByLabel("Zoekterm").fill("PRJ-001")
  await page
    .getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    })
    .click()

  await page
    .getByRole("button", { name: "Project bespreken op overleg" })
    .click()
  let panel = page.getByRole("dialog", { name: "Bespreken op overleg" })
  await panel.getByRole("radio", { name: /Projectoverleg agenda/ }).check()
  await panel
    .getByLabel("Reden of gewenste bespreking")
    .fill("Algemene projectvoortgang bespreken.")
  await panel.getByRole("button", { name: "Op agenda plaatsen" }).click()
  await expect(
    page.getByText(
      "Ingepland voor overleg in de lokale sessie · back-up nodig",
    ),
  ).toBeVisible()

  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: /TOP-001 Tijdelijke toegang openen/ })
    .click()
  await page
    .getByRole("button", { name: "Bespreken op overleg", exact: true })
    .click()
  panel = page.getByRole("dialog", { name: "Bespreken op overleg" })
  await panel.getByRole("radio", { name: /Projectoverleg agenda/ }).check()
  await panel.getByRole("button", { name: "Op agenda plaatsen" }).click()

  await expect(page.getByText("1 keer ingepland")).toBeVisible()
  await page
    .getByRole("link", { name: "Projectoverleg agenda", exact: true })
    .click()
  const agenda = page.locator(".meeting-agenda--grouped")
  await expect(agenda).toContainText("PRJ-001 · Synthetisch renovatieproject")
  await expect(agenda).toContainText("TOP-001 · Tijdelijke toegang")
})
