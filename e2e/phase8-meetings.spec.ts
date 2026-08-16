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
    .getByRole("link", { name: "Overleg" })
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
    sourceType?: "Topic" | "Action"
  }) => {
    await page.getByRole("button", { name: "+ Agendapunt" }).click()
    const panel = page.getByRole("dialog", { name: "Agendapunt toevoegen" })
    await panel.getByLabel("Titel").fill(input.title)
    await panel.getByLabel("Aanleiding").fill(input.reason)
    await panel
      .getByLabel("Notities")
      .fill(`Voorbereidingsnotitie voor ${input.title}.`)
    if (input.sourceType) {
      await panel.getByLabel("Brontype").selectOption(input.sourceType)
      await panel.getByLabel("Bronrecord").selectOption({ index: 1 })
    }
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
    sourceType: "Action",
  })
  await addAgendaItem({
    title: "Rondvraag",
    reason: "Vrij agendapunt",
  })
  await page.getByRole("button", { name: "Rondvraag omhoog" }).click()
  await expect(page.locator(".meeting-agenda > ol > li")).toHaveCount(3)

  await page.getByRole("button", { name: /^Verwerken/ }).click()
  await page.getByRole("checkbox").first().check()
  const topicAgendaItem = page
    .getByText("Tijdelijke toegang bespreken", { exact: true })
    .locator("xpath=ancestor::li[1]")

  await topicAgendaItem.getByRole("button", { name: "+ Update" }).click()
  panel = page.getByRole("dialog", { name: "Update toevoegen" })
  await panel
    .getByRole("textbox", { name: "Bijdrage", exact: true })
    .fill("De tijdelijke toegang is technisch gevalideerd.")
  await panel.getByLabel("Instellen als actuele stand van de bron").check()
  await panel.getByRole("button", { name: "Update opslaan" }).click()
  await expect(
    page.getByText("De tijdelijke toegang is technisch gevalideerd."),
  ).toBeVisible()

  await topicAgendaItem.getByRole("button", { name: "+ Beslissing" }).click()
  panel = page.getByRole("dialog", { name: "Beslissing toevoegen" })
  await panel
    .getByLabel("Beslissing")
    .fill("De technische toegangsvariant is definitief goedgekeurd.")
  await panel.getByRole("button", { name: "Beslissing opslaan" }).click()
  await expect(
    page.getByText("De technische toegangsvariant is definitief goedgekeurd."),
  ).toBeVisible()
  await topicAgendaItem.getByRole("button", { name: "+ Actie" }).click()
  panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await panel.getByLabel("Titel").fill("Werfzone toegang afbakenen")
  await panel.getByLabel("Eigenaar").selectOption({ index: 1 })
  await panel.getByLabel("Deadline").fill("2026-08-20")
  await panel.getByRole("button", { name: "Actie opslaan" }).click()
  await expect(page.getByText("Werfzone toegang afbakenen")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Acties per persoon" }),
  ).toBeVisible()

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
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printInvoked = "true"
    }
  })
  await page.getByRole("button", { name: "Afdrukken" }).click()
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-invoked",
    "true",
  )
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
  await expect(page.getByText("Fase 8 werfoverleg")).toBeVisible()
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: /TOP-001 Tijdelijke toegang openen/ })
    .click()
  await page.getByRole("button", { name: "+ Update" }).click()
  panel = page.getByRole("form", { name: "Update toevoegen" })
  await panel
    .getByRole("textbox", { name: "Schrijf een update", exact: true })
    .fill("Latere bronwijziging die niet in verslagversie 1 mag verschijnen.")
  await panel.getByRole("button", { name: "Toevoegen" }).click()

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
