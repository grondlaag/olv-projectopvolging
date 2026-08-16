import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(90_000)

test("fase-5-hoofdflow beheert, groepeert en roundtript acties volledig lokaal", async ({
  page,
}) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  let importDialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await importDialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/json/small-valid.json"),
    )
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible()
  await importDialog.getByRole("button", { name: "Bestand openen" }).click()

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
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: "TOP-001 Tijdelijke toegang openen" })
    .click()

  await page.getByRole("button", { name: "+ Actie" }).click()
  let panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await panel.getByLabel("Titel").fill("Controle medische toegang")
  await panel.getByLabel(/Deadline/).fill("2026-08-15")
  await panel.getByRole("button", { name: "+ Nieuwe actor" }).click()
  panel = page.getByRole("dialog", { name: "Nieuwe actor" })
  await panel.getByLabel("Naam").fill("E2E Actiehouder")
  await panel.getByLabel("E-mail").fill("actiehouder@example.test")
  await panel.getByLabel("Organisatie").fill("OLV Test")
  await panel.getByLabel("Rol").fill("Actiehouder")
  await panel.getByRole("button", { name: "Actor opslaan" }).click()

  panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await expect(panel.getByLabel("Titel")).toHaveValue(
    "Controle medische toegang",
  )
  await expect(panel.getByLabel("Eigenaar")).toHaveValue(/.+/)
  await page.screenshot({
    path: "test-results/phase5-action-quick-input.png",
    fullPage: true,
  })
  await panel.getByRole("button", { name: "Actie opslaan" }).click()
  await expect(
    page.getByText("Controle medische toegang").first(),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Dashboard" })
    .click()
  await expect(
    page.locator(".dashboard-kpi").filter({ hasText: "Open acties" }),
  ).toContainText("1")
  await expect(
    page
      .locator(".dashboard-kpi")
      .filter({ hasText: "Acties komende 14 dagen" }),
  ).toContainText("1")
  await expect(page.getByText("Acties die aandacht vragen")).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Acties" })
    .click()
  await page.getByLabel("Eigenaar").selectOption({ label: "E2E Actiehouder" })
  await expect(
    page.getByRole("button", { name: /Controle medische toegang/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Per eigenaar" }).click()
  await expect(
    page.getByRole("heading", { name: "E2E Actiehouder" }),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/phase5-actions-by-owner.png",
    fullPage: true,
  })

  await page.getByRole("button", { name: /Controle medische toegang/ }).click()
  panel = page.getByRole("dialog", { name: "Actie bewerken" })
  await panel.getByLabel("Eigenaar").selectOption({ label: "Testcoördinator" })
  await panel.getByLabel(/Deadline/).fill("2026-08-01")
  await panel.getByLabel("Status").selectOption("Bezig")
  await panel.getByLabel("Prioriteit").selectOption("Hoog")
  await panel.getByRole("button", { name: "Wijzigingen opslaan" }).click()

  await page.getByLabel("Eigenaar").selectOption("")
  await page.getByRole("button", { name: /Controle medische toegang/ }).click()
  panel = page.getByRole("dialog", { name: "Actie bewerken" })
  await panel.getByLabel("Status").selectOption("Afgerond")
  await panel.getByLabel(/Afronddatum/).fill("2026-08-09")
  await panel.getByRole("button", { name: "Wijzigingen opslaan" }).click()
  await expect(
    page.getByRole("row", { name: /Controle medische toegang/ }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Alles" }).click()
  await expect(
    page.getByRole("row", { name: /Controle medische toegang/ }),
  ).toContainText("Afgerond")

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase5-actions-roundtrip.json",
  )
  await download.saveAs(exportedPath)

  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  importDialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await importDialog.locator('input[type="file"]').setInputFiles(exportedPath)
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible({
    timeout: 20_000,
  })
  await importDialog.getByRole("button", { name: "Bestand openen" }).click()
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Acties" })
    .click()
  await page
    .getByRole("searchbox", { name: "Zoeken" })
    .fill("Controle medische toegang")
  await page.getByRole("button", { name: "Alles" }).click()
  await expect(
    page.getByRole("row", { name: /Controle medische toegang/ }),
  ).toContainText("Afgerond")
  await page.setViewportSize({ width: 720, height: 900 })
  await page.screenshot({
    path: "test-results/phase5-actions-mobile.png",
    fullPage: true,
  })
})
