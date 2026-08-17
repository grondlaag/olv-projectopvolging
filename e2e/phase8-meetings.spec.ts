import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(180_000)

test("fase-8-hoofdflow verwerkt overleg en bewaart een historisch verslag via JSON", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000)
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
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: /TOP-001 Tijdelijke toegang openen/ })
    .click()
  await page.getByRole("button", { name: "+ Actie" }).click()
  let panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await panel.getByLabel("Titel").fill("Bestaande toegangsactie opvolgen")
  await panel.getByLabel("Eigenaar").selectOption({ index: 1 })
  await panel.getByLabel(/Deadline/).fill("2026-08-18")
  await panel.getByRole("button", { name: "Actie opslaan" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg", exact: true })
    .click()
  await page.getByRole("button", { name: "+ Nieuw overleg" }).first().click()
  await page.getByLabel("Nummer").fill("OV-F8-E2E")
  await page.getByLabel("Titel").fill("Fase 8 werfoverleg")
  await page.getByLabel("Datum").fill("2026-08-12")
  await page.getByLabel("Volgend overleg").fill("2026-08-26")
  await page.locator('select[name="scopeId"]').selectOption({ index: 1 })
  await page.locator('select[name="chairActorId"]').selectOption({ index: 1 })
  await page
    .locator('select[name="reporterActorId"]')
    .selectOption({ index: 1 })
  await page.getByRole("checkbox").first().check()
  await page.getByRole("button", { name: "Overleg opslaan" }).click()

  await expect(
    page.getByRole("heading", { name: "Fase 8 werfoverleg" }),
  ).toBeVisible()

  const addAgendaItem = async (input: {
    title: string
    reason: string
    sourceType: "Project" | "Topic"
  }) => {
    await page.getByRole("button", { name: "+ Project of topic" }).click()
    const panel = page.getByRole("dialog", { name: "Agendapunt toevoegen" })
    await panel.getByLabel("Brontype").selectOption(input.sourceType)
    await panel.getByLabel("Bronrecord").selectOption({ index: 1 })
    await panel.getByLabel("Titel").fill(input.title)
    await panel.getByLabel("Aanleiding").fill(input.reason)
    await panel
      .getByLabel("Notities")
      .fill(`Voorbereidingsnotitie voor ${input.title}.`)
    await panel.getByRole("button", { name: "Agendapunt opslaan" }).click()
  }

  await addAgendaItem({
    title: "Tijdelijke toegang bespreken",
    reason: "Bestaand projecttopic",
    sourceType: "Topic",
  })
  await addAgendaItem({
    title: "Bestaande actie opvolgen",
    reason: "Open projectactie",
    sourceType: "Project",
  })
  await expect(page.locator(".meeting-agenda-groups li")).toHaveCount(2)

  await page.getByRole("button", { name: /^Verwerken/ }).click()
  await page.getByRole("checkbox").first().check()
  const composer = page.getByRole("form", {
    name: /Bijdrage toevoegen aan Tijdelijke toegang bespreken/,
  })
  await composer
    .getByPlaceholder(/Wat is er gewijzigd/)
    .fill("De tijdelijke toegang is technisch gevalideerd.")
  await composer.getByLabel("Maak actuele stand").check()
  await composer.getByRole("button", { name: "Update opslaan" }).click()
  await expect(
    page.getByText("De tijdelijke toegang is technisch gevalideerd.").first(),
  ).toBeVisible()

  await composer.getByRole("button", { name: "Beslissing" }).click()
  await composer
    .getByPlaceholder(/Welke beslissing/)
    .fill("De technische toegangsvariant is definitief goedgekeurd.")
  await composer.getByRole("button", { name: "Beslissing opslaan" }).click()
  await page
    .getByLabel("Context tijdens overleg")
    .getByText("Journaal", { exact: true })
    .click()
  await expect(
    page
      .getByText("De technische toegangsvariant is definitief goedgekeurd.")
      .first(),
  ).toBeVisible()
  await composer.getByRole("button", { name: "Actie" }).click()
  await composer
    .getByPlaceholder("Wat moet gebeuren?")
    .fill("Werfzone toegang afbakenen")
  await composer.getByLabel("Eigenaar").selectOption({ index: 1 })
  await composer.getByLabel("Deadline").fill("2026-08-20")
  await composer.getByRole("button", { name: "Actie opslaan" }).click()
  await expect(
    page.getByText("Werfzone toegang afbakenen").first(),
  ).toBeVisible()
  await page.getByRole("button", { name: "Focusmodus" }).click()
  await expect(
    page.getByRole("button", { name: "Overzicht tonen" }),
  ).toBeVisible()
  await expect(page.locator("aside.meeting-process-agenda")).toBeHidden()
  await expect(page.locator("aside.meeting-process-context")).toBeHidden()
  await page.screenshot({
    path: "test-results/phase8-meeting-processing.png",
    fullPage: true,
  })
  await page.getByRole("button", { name: "Overzicht tonen" }).click()

  await page.getByRole("button", { name: "Conceptverslag opbouwen" }).click()
  await expect(
    page.getByRole("heading", { name: "Verslag versie 1" }),
  ).toBeVisible()
  await expect(
    page.getByText("De technische toegangsvariant is definitief goedgekeurd."),
  ).toBeVisible()
  await expect(page.locator(".meeting-report-owner-groups")).toContainText(
    "Testcoördinator",
  )
  const reportPdfPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Verslag PDF" }).click()
  const reportPdf = await reportPdfPromise
  expect(reportPdf.suggestedFilename()).toMatch(/verslag-.+\.pdf$/)
  await page.getByRole("button", { name: "Definitief maken" }).click()
  await page.getByRole("button", { name: "Ja, definitief maken" }).click()
  await expect(page.getByText("Historisch vastgelegd")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: "test-results/phase8-definitive-report.png",
    fullPage: true,
  })
  await page.emulateMedia({ media: "print" })
  await expect(page.locator(".app-header")).toBeHidden()
  await expect(page.locator(".main-navigation")).toBeHidden()
  await page.screenshot({
    path: "test-results/phase8-print-preview.png",
    fullPage: true,
  })
  await page.emulateMedia({ media: "screen" })

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
  await expect(
    page.getByRole("link", { name: "Overleg Fase 8 werfoverleg" }),
  ).toBeVisible()
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: /TOP-001 Tijdelijke toegang openen/ })
    .click()
  await page.getByRole("button", { name: "+ Bijdrage" }).click()
  panel = page.getByRole("form", { name: /Bijdrage toevoegen aan/ })
  await panel
    .getByPlaceholder(/Wat is er gewijzigd/)
    .fill("Latere bronwijziging die niet in verslagversie 1 mag verschijnen.")
  await panel.getByRole("button", { name: "Update opslaan" }).click()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg" })
    .click()
  await page.getByRole("searchbox", { name: "Zoeken" }).fill("OV-F8-E2E")
  await page.getByRole("button", { name: "Fase 8 werfoverleg openen" }).click()
  await page.getByRole("button", { name: /^Verslag/ }).click()
  await expect(
    page.getByText("De technische toegangsvariant is definitief goedgekeurd."),
  ).toBeVisible()
  await expect(
    page.getByText(
      "Latere bronwijziging die niet in verslagversie 1 mag verschijnen.",
    ),
  ).toHaveCount(0)

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase8-meeting-roundtrip.json",
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
    .getByRole("link", { name: "Overleg" })
    .click()
  await page.getByRole("searchbox", { name: "Zoeken" }).fill("OV-F8-E2E")
  await page.getByRole("button", { name: "Fase 8 werfoverleg openen" }).click()
  await page.getByRole("button", { name: /^Verslag/ }).click()
  await expect(
    page.getByRole("heading", { name: "Verslag versie 1" }),
  ).toBeVisible()
  await expect(
    page.getByText("De technische toegangsvariant is definitief goedgekeurd."),
  ).toBeVisible()
  await expect(page.getByText("Historisch vastgelegd")).toBeVisible()
})
