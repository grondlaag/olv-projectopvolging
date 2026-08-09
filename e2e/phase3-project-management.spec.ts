import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("fase-3-hoofdflow beheert en roundtript een project volledig lokaal", async ({
  page,
}) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "Excelbestand laden" }).click()
  let importDialog = page.getByRole("dialog", { name: "Excelbestand laden" })
  await importDialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/excel/small-valid.xlsx"),
    )
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible()
  await importDialog.getByRole("button", { name: "Import bevestigen" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByRole("button", { name: "+ Nieuw project" }).click()
  await page.getByLabel("Projectcode").fill("PRJ-F3-E2E")
  await page.getByLabel("Titel").fill("Fase 3 hoofdflow")
  await page
    .getByLabel("Omschrijving")
    .fill("Synthetisch project voor de browserhoofdflow.")
  await page.getByLabel("Hoofdstuk").selectOption({ index: 1 })
  await page.getByLabel("Status").selectOption("Uitvoering")
  await page.getByLabel("Fase").fill("Realisatie")
  await page.getByLabel("Site").fill("Campus Test")
  await page.getByLabel(/Startdatum/).fill("2026-08-10")
  await page.getByLabel(/Geplande einddatum/).fill("2027-02-28")
  await page.getByLabel(/Voortgang/).fill("12")

  await page.getByRole("button", { name: "+ Nieuwe actor" }).click()
  const actorDialog = page.getByRole("dialog", { name: "Nieuwe actor" })
  await actorDialog.getByLabel("Naam").fill("E2E Projectcoördinator")
  await actorDialog.getByLabel(/E-mail/).fill("e2e.coordinator@example.test")
  await actorDialog.getByLabel(/Organisatie/).fill("OLV Test")
  await actorDialog.getByLabel(/Rol/).fill("Projectcoördinator")
  await actorDialog.getByRole("button", { name: "Actor opslaan" }).click()
  await expect(page.getByLabel(/Projectcoördinator/)).toHaveValue(/.+/)

  await page.getByRole("button", { name: "+ Nieuwe cluster" }).click()
  const clusterDialog = page.getByRole("dialog", { name: "Nieuwe cluster" })
  await clusterDialog.getByLabel("Clustercode").fill("CL-F3-E2E")
  await clusterDialog.getByLabel("Clusternaam").fill("E2E cluster")
  await clusterDialog.getByLabel("Omschrijving").fill("Synthetische cluster.")
  await page.screenshot({
    path: "test-results/phase3-project-form.png",
    fullPage: true,
  })
  await clusterDialog.getByRole("button", { name: "Cluster opslaan" }).click()
  await expect(page.getByLabel(/Cluster/)).toHaveValue(/.+/)
  await expect(page.getByLabel("Titel")).toHaveValue("Fase 3 hoofdflow")

  await page.getByRole("button", { name: "Project opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Fase 3 hoofdflow" }),
  ).toBeVisible()
  await expect(
    page.getByText("Opgeslagen in sessie · nog exporteren"),
  ).toBeVisible()
  await expect(
    page.getByText("E2E cluster", { exact: true }).first(),
  ).toBeVisible()

  await page.getByRole("button", { name: "Project bewerken" }).click()
  await page.getByLabel("Titel").fill("Fase 3 hoofdflow gewijzigd")
  await page.getByRole("button", { name: "Wijzigingen opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Fase 3 hoofdflow gewijzigd" }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Exporteren" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase3-roundtrip.xlsx",
  )
  await download.saveAs(exportedPath)

  await page.getByRole("button", { name: "Excel laden" }).click()
  importDialog = page.getByRole("dialog", { name: "Excelbestand laden" })
  await importDialog.locator('input[type="file"]').setInputFiles(exportedPath)
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible({
    timeout: 20_000,
  })
  await importDialog.getByRole("button", { name: "Import bevestigen" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByLabel("Zoekterm").fill("PRJ-F3-E2E")
  await expect(
    page.getByRole("button", {
      name: "PRJ-F3-E2E Fase 3 hoofdflow gewijzigd openen",
    }),
  ).toBeVisible()
  await page
    .getByRole("button", {
      name: "PRJ-F3-E2E Fase 3 hoofdflow gewijzigd openen",
    })
    .click()
  await expect(
    page.getByText("E2E Projectcoördinator", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByText("E2E cluster", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText("Project aangemaakt")).toBeVisible()
  await page.screenshot({
    path: "test-results/phase3-project-dossier.png",
    fullPage: true,
  })
  await page.close()
})
