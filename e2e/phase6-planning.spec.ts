import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(120_000)

test("fase-6-hoofdflow beheert planning, Gantt en JSON-roundtrip lokaal", async ({
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

  await page.getByRole("button", { name: "+ Nieuw topic" }).first().click()
  let panel = page.getByRole("dialog", { name: "Nieuw topic" })
  await panel.getByText("Meer opties", { exact: true }).click()
  await panel.getByLabel("Topiccode").fill("TOP-F6-E2E")
  await panel.getByLabel("Titel").fill("Fasering medische verhuis")
  await panel
    .getByLabel("Vaste context")
    .fill(
      "Plant de verhuisbewegingen zonder de zorgcontinuïteit te onderbreken.",
    )
  await panel.getByLabel("Eigenaar").selectOption({ index: 1 })
  await panel.getByRole("button", { name: "Topic opslaan" }).click()

  await page.getByRole("button", { name: "+ Timing" }).click()
  panel = page.getByRole("dialog", { name: "Timing toevoegen" })
  await panel.getByLabel("Startdatum").fill("2026-08-10")
  await panel.getByLabel("Geplande einddatum").fill("2026-09-30")
  await panel.getByLabel("Voortgang").fill("20")
  await panel.getByLabel("Status").selectOption("Op schema")
  await panel.getByRole("button", { name: "Timing opslaan" }).click()
  await expect(
    page.getByRole("button", { name: "Timing bewerken" }),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: "Planning" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Projectplanning" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "+ Mijlpaal" }).click()
  panel = page.getByRole("dialog", { name: "Mijlpaal toevoegen" })
  await panel.getByLabel("Titel").fill("E2E verhuisstart")
  await panel.getByLabel("Mijlpaaldatum").fill("2026-10-05")
  await panel.getByLabel("Voortgang").fill("0")
  await panel.getByRole("button", { name: "Planningitem opslaan" }).click()

  await expect(
    page.getByRole("heading", { name: "Project-Gantt" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /E2E verhuisstart, mijlpaal op/ }),
  ).toBeVisible()
  await page.getByLabel("Kwartaal").click()
  await expect(page.locator(".planning-gantt")).toHaveAttribute(
    "data-zoom",
    "quarter",
  )
  await page.screenshot({
    path: "test-results/phase6-project-gantt.png",
    fullPage: true,
  })

  await page.getByRole("button", { name: "+ Afhankelijkheid" }).click()
  panel = page.getByRole("dialog", { name: "Afhankelijkheid toevoegen" })
  await panel
    .getByLabel("Voorganger")
    .selectOption({ label: "Fasering medische verhuis" })
  await panel.getByLabel("Opvolger").selectOption({ label: "E2E verhuisstart" })
  await panel.getByRole("button", { name: "Afhankelijkheid opslaan" }).click()
  await expect(
    page.getByText(
      "Afhankelijkheid opgeslagen in de lokale sessie · JSON nog opslaan",
    ),
  ).toBeVisible()

  await page.getByRole("button", { name: "+ Afhankelijkheid" }).click()
  panel = page.getByRole("dialog", { name: "Afhankelijkheid toevoegen" })
  await panel
    .getByLabel("Voorganger")
    .selectOption({ label: "E2E verhuisstart" })
  await panel
    .getByLabel("Opvolger")
    .selectOption({ label: "Fasering medische verhuis" })
  await panel.getByRole("button", { name: "Afhankelijkheid opslaan" }).click()
  await expect(panel.getByRole("alert")).toContainText("cyclus in de planning")
  await panel.getByRole("button", { name: "Sluiten" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Planning" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Portfolio-Gantt" }),
  ).toBeVisible()
  const planningSummary = page.getByRole("region", {
    name: "Samenvatting portfolioplanning",
  })
  await expect(planningSummary).toContainText("Planningdekking")
  await expect(planningSummary).toContainText("Planningitems")
  await expect(planningSummary).toContainText("Aandacht")
  await expect(page.getByText("Zonder cluster", { exact: true })).toBeVisible()
  await page.screenshot({
    path: "test-results/phase6-portfolio-gantt.png",
    fullPage: true,
  })

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase6-planning-roundtrip.json",
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
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByLabel("Zoekterm").fill("PRJ-001")
  await page
    .getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    })
    .click()
  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: "Planning" })
    .click()
  await expect(
    page
      .locator(".planning-gantt__labels")
      .getByText("Fasering medische verhuis"),
  ).toBeVisible()
  await expect(
    page.locator(".planning-gantt__labels").getByText("E2E verhuisstart"),
  ).toBeVisible()
  await expect(
    page
      .locator(".planning-dependency-list li")
      .filter({ hasText: "Fasering medische verhuis" }),
  ).toContainText("E2E verhuisstart")
})
