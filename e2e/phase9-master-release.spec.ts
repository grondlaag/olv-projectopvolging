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

async function navigateWithinApp(page: Page, route: string) {
  const hash = new URL(route, "http://local").hash
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash
  }, hash)
  await expect(page).toHaveURL(new RegExp(`${hash.replaceAll("/", "\\/")}$`))
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

  await page.getByRole("link", { name: /^Journaal/ }).click()
  await page
    .getByRole("button", { name: /Nieuw topic/ })
    .first()
    .click()
  await page.getByLabel("Titel nieuw topic").fill("Façade en medische toegang")
  await page.getByRole("button", { name: "Topic toevoegen" }).click()
  const topic = page.locator(".journal-topic").filter({
    hasText: "Façade en medische toegang",
  })
  const composer = topic.getByLabel(
    "Nieuwe bijdrage aan Façade en medische toegang",
  )
  await composer.fill("De uitvoeringsvariant is klaar voor validatie.")
  await composer.press("Enter")
  await topic.getByLabel("Soort bijdrage").selectOption("decision")
  await composer.fill("De voorgestelde toegangsroute is goedgekeurd.")
  await composer.press("Enter")
  await topic.getByLabel("Soort bijdrage").selectOption("action")
  await composer.fill("Signalisatie werfroute plaatsen")
  await composer.press("Enter")
  await topic.locator(".journal-topic__header").click()
  const properties = page.getByRole("complementary", {
    name: "Topiceigenschappen",
  })
  await properties
    .getByLabel("Eigenaar")
    .selectOption({ label: "Releasecoördinator" })
  await properties.getByLabel("Prioriteit").selectOption("Hoog")

  await navigateWithinApp(page, `/#/projects/${projectId}/budget`)
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
    .selectOption({ label: "T-001 · Façade en medische toegang" })
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
    label: "Releasecoördinator",
  })
  await page.getByLabel(/Releasecoördinator/).check()
  await page.getByRole("button", { name: "Overleg opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "Release werfoverleg" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "+ Project of topic" }).click()
  panel = page.getByRole("dialog", { name: "Agendapunt toevoegen" })
  await panel.getByLabel("Titel").fill("Toegangsroute definitief vastleggen")
  await panel.getByLabel("Aanleiding").fill("Open topic uit de projectscope")
  await panel.getByLabel("Brontype").selectOption("Topic")
  await panel
    .getByLabel("Bronrecord")
    .selectOption({ label: "T-001 · Façade en medische toegang" })
  await panel.getByRole("button", { name: "Agendapunt opslaan" }).click()
  await page.getByRole("button", { name: /^Verwerken/ }).click()
  const meetingComposer = page.getByLabel(
    "Schrijf verder bij Toegangsroute definitief vastleggen",
  )
  await meetingComposer.fill(
    "/besluit De route wordt opgenomen in het uitvoeringsdossier.",
  )
  await meetingComposer.press("Enter")
  await meetingComposer.fill("/actie Uitvoeringsplan actualiseren")
  await meetingComposer.press("Enter")
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
  await expect(page.getByText(/Releasecluster/)).toBeVisible()
  await expect(
    page.getByText("Releasecoördinator", { exact: true }).first(),
  ).toBeVisible()
  await page.getByRole("link", { name: /^Journaal/ }).click()
  const restoredTopic = page.locator(".journal-topic").filter({
    hasText: "Façade en medische toegang",
  })
  await expect(restoredTopic).toContainText(
    "De uitvoeringsvariant is klaar voor validatie.",
  )
  await expect(restoredTopic).toContainText(
    "De voorgestelde toegangsroute is goedgekeurd.",
  )
  await expect(restoredTopic).toContainText("Signalisatie werfroute plaatsen")
  await navigateWithinApp(page, `/#/projects/${projectId}/budget`)
  await expect(
    page.getByText("Extra signalisatie en tijdelijke afscheiding"),
  ).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Overleg" })
    .click()
  await page
    .getByRole("region", { name: "Filters" })
    .getByText("Filters", { exact: true })
    .click()
  await page.getByRole("searchbox", { name: "Zoeken" }).fill("OV-REL-09")
  await page.getByRole("button", { name: "Release werfoverleg openen" }).click()
  await page.getByRole("button", { name: /^Verslag/ }).click()
  await expect(page.getByText("Historisch vastgelegd")).toBeVisible()
  await expect(
    page.getByText("De route wordt opgenomen in het uitvoeringsdossier."),
  ).toBeVisible()
})
