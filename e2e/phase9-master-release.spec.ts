import { resolve } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"

test.setTimeout(240_000)

async function openDataFile(page: Page, path: string) {
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await dialog.locator('input[type="file"]').setInputFiles(path)
  await expect(dialog.getByText("Blocking: 0")).toBeVisible({
    timeout: 25_000,
  })
  await dialog.getByRole("button", { name: "Bestand openen" }).click()
}

async function addActor(panel: Locator, name: string, role: string) {
  await panel.getByRole("button", { name: "+ Nieuwe actor" }).click()
  const actorPanel = panel.page().getByRole("dialog", { name: "Nieuwe actor" })
  await actorPanel.getByLabel("Naam").fill(name)
  await actorPanel.getByLabel("Type").selectOption("Intern")
  await actorPanel
    .getByLabel(/E-mail/)
    .fill(
      `${role.startsWith("Project") ? "coordinator" : "topic"}@example.test`,
    )
  await actorPanel.getByLabel(/Organisatie/).fill("OLV Releaseproef")
  await actorPanel.getByLabel(/Rol/).fill(role)
  await actorPanel.getByRole("button", { name: "Actor opslaan" }).click()
  await expect(actorPanel).toHaveCount(0)
}

test("fase 9 masterflow bewaart alle relaties na export en herimport", async ({
  page,
}) => {
  page.setDefaultTimeout(15_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/#/dashboard")
  await openDataFile(
    page,
    resolve(process.cwd(), "src/tests/fixtures/json/small-valid.json"),
  )

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByRole("button", { name: "+ Nieuw project" }).click()
  await page.getByLabel("Projectcode").fill("PRJ-REL-09")
  await page.getByLabel("Titel").fill("Releaseproef patiëntenzone")
  await page
    .getByLabel("Omschrijving")
    .fill("Volledige lokale masterflow voor de productierelease.")
  await page.getByLabel("Hoofdstuk").selectOption({ index: 1 })
  await page.getByLabel("Status").selectOption("Uitvoering")
  await page.getByLabel("Fase").fill("Realisatie")
  await page.getByLabel(/Startdatum/).fill("2026-08-10")
  await page.getByLabel(/Geplande einddatum/).fill("2027-02-28")
  await page.getByLabel(/Voortgang/).fill("15")
  await addActor(
    page.locator(".project-form"),
    "Releasecoördinator",
    "Projectcoördinator",
  )
  await page.getByRole("button", { name: "+ Nieuwe cluster" }).click()
  let panel = page.getByRole("dialog", { name: "Nieuwe cluster" })
  await panel.getByLabel("Clustercode").fill("CL-REL-09")
  await panel.getByLabel("Clusternaam").fill("Releasecluster")
  await panel
    .getByLabel("Omschrijving")
    .fill("Cluster aangemaakt zonder formuliercontextverlies.")
  await panel.getByRole("button", { name: "Cluster opslaan" }).click()
  await expect(page.getByLabel("Titel")).toHaveValue(
    "Releaseproef patiëntenzone",
  )
  await page.getByRole("button", { name: "Project opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Releaseproef patiëntenzone" }),
  ).toBeVisible()
  const projectUrl = page.url()
  const projectId = projectUrl.match(/projects\/([0-9a-f-]+)/)?.[1]
  expect(projectId).toBeTruthy()

  await page.getByRole("link", { name: /^Topics/ }).click()
  await page.getByRole("button", { name: "+ Nieuw topic" }).first().click()
  panel = page.getByRole("dialog", { name: "Nieuw topic" })
  await panel.getByText("Meer opties", { exact: true }).click()
  await panel.getByLabel("Topiccode").fill("TOP-REL-09")
  await panel.getByLabel("Titel").fill("Façade en medische toegang")
  await panel
    .getByLabel("Vaste context")
    .fill("De zorgcontinuïteit moet tijdens de werken behouden blijven.")
  await addActor(panel, "Topicverantwoordelijke", "Topicverantwoordelijke")
  await expect(panel.getByLabel("Titel")).toHaveValue(
    "Façade en medische toegang",
  )
  await panel.getByLabel("Prioriteit").selectOption("Hoog")
  await panel.getByRole("button", { name: "Topic opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Façade en medische toegang" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Bijwerken" }).click()
  let quickEntry = page.getByRole("form", { name: "Actuele stand bijwerken" })
  await quickEntry
    .getByLabel("Nieuwe actuele stand")
    .fill("De uitvoeringsvariant is klaar voor validatie.")
  await quickEntry.getByRole("button", { name: "Toevoegen" }).click()
  await expect(page.locator(".topic-current")).toContainText(
    "De uitvoeringsvariant is klaar voor validatie.",
  )

  await page.getByRole("button", { name: "+ Update" }).click()
  quickEntry = page.getByRole("form", { name: "Update toevoegen" })
  await quickEntry
    .getByLabel("Schrijf een update")
    .fill("De brandweer heeft de route technisch nagekeken.")
  await quickEntry.getByRole("button", { name: "Toevoegen" }).click()
  await page.getByRole("button", { name: "+ Beslissing" }).click()
  quickEntry = page.getByRole("form", { name: "Beslissing toevoegen" })
  await quickEntry
    .getByLabel("Schrijf een beslissing")
    .fill("De voorgestelde toegangsroute is goedgekeurd.")
  await quickEntry.getByRole("button", { name: "Beslissing toevoegen" }).click()

  await page.getByRole("button", { name: "+ Actie" }).click()
  panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await panel.getByLabel("Titel").fill("Signalisatie werfroute plaatsen")
  await panel
    .getByLabel("Eigenaar")
    .selectOption({ label: "Topicverantwoordelijke" })
  await panel.getByLabel(/Deadline/).fill("2026-09-15")
  await panel.getByRole("button", { name: "Actie opslaan" }).click()

  await page.getByRole("button", { name: "+ Timing" }).click()
  panel = page.getByRole("dialog", { name: "Timing toevoegen" })
  await panel.getByLabel("Startdatum").fill("2026-08-15")
  await panel.getByLabel("Geplande einddatum").fill("2026-10-31")
  await panel.getByLabel("Voortgang").fill("25")
  await panel.getByLabel("Status").selectOption("Op schema")
  await panel.getByRole("button", { name: "Timing opslaan" }).click()

  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: "Planning" })
    .click()
  await page.getByRole("button", { name: "+ Mijlpaal" }).click()
  panel = page.getByRole("dialog", { name: "Mijlpaal toevoegen" })
  await panel.getByLabel("Titel").fill("Vrijgave patiëntenzone")
  await panel.getByLabel("Mijlpaaldatum").fill("2026-11-15")
  await panel.getByRole("button", { name: "Planningitem opslaan" }).click()
  await expect(page.getByText("Vrijgave patiëntenzone")).toBeVisible()

  await page.goto(`/#/projects/${projectId}/budget`)
  await page.getByRole("button", { name: "+ Budgetitem" }).click()
  panel = page.getByRole("dialog", { name: "Budgetitem toevoegen" })
  await panel.getByLabel("Type").selectOption("Meerwerk")
  await panel.getByLabel("Categorie").fill("Toegang")
  await panel.getByLabel("Bedrag").fill("12.345,67")
  await panel.getByLabel("Datum").fill("2026-08-20")
  await panel
    .getByLabel("Omschrijving")
    .fill("Extra signalisatie en tijdelijke afscheiding")
  await panel.getByText("Meer opties", { exact: true }).click()
  await panel.getByLabel("Status").selectOption("Vastgelegd")
  await panel
    .getByLabel("Topic")
    .selectOption({ label: "TOP-REL-09 · Façade en medische toegang" })
  await panel.getByRole("button", { name: "Budgetitem opslaan" }).click()
  await expect(
    page.getByText("Extra signalisatie en tijdelijke afscheiding"),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg" })
    .click()
  await page.getByRole("button", { name: "+ Nieuw overleg" }).first().click()
  await page.getByLabel("Nummer").fill("OV-REL-09")
  await page.getByLabel("Titel").fill("Release werfoverleg")
  await page.getByLabel("Datum").fill("2026-08-25")
  await page.locator('select[name="scopeId"]').selectOption({
    label: "PRJ-REL-09 · Releaseproef patiëntenzone",
  })
  await page.locator('select[name="chairActorId"]').selectOption({
    label: "Releasecoördinator",
  })
  await page.locator('select[name="reporterActorId"]').selectOption({
    label: "Topicverantwoordelijke",
  })
  await page.getByLabel(/Releasecoördinator/).check()
  await page.getByLabel(/Topicverantwoordelijke/).check()
  await page.getByRole("button", { name: "Overleg opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Release werfoverleg" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "+ Agendapunt" }).click()
  panel = page.getByRole("dialog", { name: "Agendapunt toevoegen" })
  await panel.getByLabel("Titel").fill("Toegangsroute definitief vastleggen")
  await panel.getByLabel("Aanleiding").fill("Open topic uit de projectscope")
  await panel.getByLabel("Brontype").selectOption("Topic")
  await panel
    .getByLabel("Bronrecord")
    .selectOption({ label: "TOP-REL-09 · Façade en medische toegang" })
  await panel.getByRole("button", { name: "Agendapunt opslaan" }).click()
  await page.getByRole("button", { name: /^Verwerken/ }).click()
  const agenda = page
    .getByText("Toegangsroute definitief vastleggen", { exact: true })
    .locator("xpath=ancestor::li[1]")
  await agenda.getByRole("button", { name: "+ Beslissing" }).click()
  panel = page.getByRole("dialog", { name: "Beslissing toevoegen" })
  await panel
    .getByLabel("Beslissing")
    .fill("De route wordt opgenomen in het uitvoeringsdossier.")
  await panel.getByRole("button", { name: "Beslissing opslaan" }).click()
  await agenda.getByRole("button", { name: "+ Actie" }).click()
  panel = page.getByRole("dialog", { name: "Actie toevoegen" })
  await panel.getByLabel("Titel").fill("Uitvoeringsplan actualiseren")
  await panel
    .getByLabel("Eigenaar")
    .selectOption({ label: "Releasecoördinator" })
  await panel.getByLabel("Deadline").fill("2026-09-20")
  await panel.getByRole("button", { name: "Actie opslaan" }).click()
  await page.getByRole("button", { name: "Conceptverslag opbouwen" }).click()
  await expect(
    page.getByRole("heading", { name: "Verslag versie 1" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Definitief maken" }).click()
  await page.getByRole("button", { name: "Ja, definitief maken" }).click()
  await expect(page.getByText("Historisch vastgelegd")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase9-master-roundtrip.json",
  )
  await download.saveAs(exportedPath)
  await openDataFile(page, exportedPath)

  const globalSearch = page.getByRole("combobox", { name: "Globaal zoeken" })
  await globalSearch.fill("PRJ-REL-09")
  await expect(
    page.getByRole("option", {
      name: /^Project PRJ-REL-09.*Releaseproef patiëntenzone/,
    }),
  ).toBeVisible()
  await globalSearch.press("Enter")
  await expect(page).toHaveURL(new RegExp(`#/projects/${projectId}$`))
  await expect(
    page.getByText("Releasecluster", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByText("Releasecoördinator", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText("Release werfoverleg")).toBeVisible()

  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", {
      name: /TOP-REL-09 Façade en medische toegang openen/,
    })
    .click()
  await expect(page.locator(".topic-current")).toContainText(
    "De uitvoeringsvariant is klaar voor validatie.",
  )
  await expect(page.locator(".topic-journal")).toContainText(
    "De voorgestelde toegangsroute is goedgekeurd.",
  )
  await expect(page.getByText("Signalisatie werfroute plaatsen")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Budgetimpact" }),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: "Planning" })
    .click()
  await expect(page.getByText("Vrijgave patiëntenzone")).toBeVisible()
  await page.goto(`/#/projects/${projectId}/budget`)
  await expect(
    page.getByText("Extra signalisatie en tijdelijke afscheiding"),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg" })
    .click()
  await page.getByRole("searchbox", { name: "Zoeken" }).fill("OV-REL-09")
  await page.getByRole("button", { name: "Release werfoverleg openen" }).click()
  await page.getByRole("button", { name: /^Verslag/ }).click()
  await expect(page.getByText("Historisch vastgelegd")).toBeVisible()
  await expect(
    page.getByText("De route wordt opgenomen in het uitvoeringsdossier."),
  ).toBeVisible()
})
