import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(90_000)

test("fase-4-hoofdflow beheert topics, actuele stand en beslissingen volledig lokaal", async ({
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

  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()
  await expect(
    page.getByText("Actuele inhoudelijke projectstand", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Open topics", { exact: true })).toBeVisible()
  await page.screenshot({
    path: "test-results/phase4-project-overview-viewport.png",
  })
  await page.screenshot({
    path: "test-results/phase4-project-overview.png",
    fullPage: true,
  })
  await page.getByRole("link", { name: /^Topics/ }).click()

  await page.getByRole("button", { name: "+ Nieuw topic" }).first().click()
  let panel = page.getByRole("dialog", { name: "Nieuw topic" })
  await panel.getByText("Meer opties", { exact: true }).click()
  await panel.getByLabel("Topiccode").fill("TOP-F4-E2E")
  await panel.getByLabel("Titel").fill("Medische validatie bouwfase")
  await panel
    .getByLabel("Vaste context")
    .fill("Valideert de bouwkundige keuzes tegen de zorgprocessen.")
  await panel.getByLabel("Eigenaar").selectOption({ index: 1 })
  await panel.getByLabel("Prioriteit").selectOption("Hoog")
  await panel.getByRole("button", { name: "Topic opslaan" }).click()

  await expect(page).toHaveURL(/#\/projects\/.+\/topics\/.+$/)
  await expect(
    page.getByRole("heading", { name: "Medische validatie bouwfase" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "+ Bijdrage" }).click()
  panel = page.getByRole("form", { name: /Bijdrage toevoegen aan/ })
  await panel
    .getByPlaceholder(/Wat is er gewijzigd/)
    .fill("De verpleegkundige looplijnen zijn nagekeken en akkoord.")
  await panel.getByRole("button", { name: "+ Nieuwe actor" }).click()
  const actorPanel = page.getByRole("dialog", { name: "Nieuwe actor" })
  await actorPanel.getByLabel("Naam").fill("E2E Update-auteur")
  await actorPanel.getByRole("button", { name: "Actor opslaan" }).click()
  panel = page.getByRole("form", { name: /Bijdrage toevoegen aan/ })
  await expect(panel.getByPlaceholder(/Wat is er gewijzigd/)).toHaveValue(
    "De verpleegkundige looplijnen zijn nagekeken en akkoord.",
  )
  await expect(panel.getByLabel("Auteur").locator("option:checked")).toHaveText(
    "E2E Update-auteur",
  )
  await panel.getByLabel("Maak actuele stand").check()
  await panel.getByRole("button", { name: "Update opslaan" }).click()
  await expect(
    page
      .locator(".topic-current")
      .getByText("De verpleegkundige looplijnen zijn nagekeken en akkoord."),
  ).toBeVisible()

  await panel.getByRole("button", { name: "Beslissing" }).click()
  await panel
    .getByPlaceholder(/Welke beslissing/)
    .fill("De huidige bouwvariant wordt zonder aanpassing behouden.")
  await panel.getByRole("button", { name: "Beslissing opslaan" }).click()

  const journalEntries = page.locator(
    ".topic-journal .conversation-feed__entry",
  )
  await expect(journalEntries).toHaveCount(2)
  await expect(journalEntries.first()).toContainText(
    "De huidige bouwvariant wordt zonder aanpassing behouden.",
  )
  await expect(journalEntries.nth(1)).toContainText(
    "De verpleegkundige looplijnen zijn nagekeken en akkoord.",
  )
  await expect(journalEntries.nth(1)).toContainText("E2E Update-auteur")
  await page.screenshot({
    path: "test-results/phase4-topic-workspace.png",
    fullPage: true,
  })

  await page.getByRole("link", { name: "Projectjournaal" }).click()
  await expect(
    page.getByRole("heading", { name: "Projectjournaal" }),
  ).toBeVisible()
  await page.getByText("Medische validatie bouwfase", { exact: true }).click()
  await expect(
    page.getByText("De huidige bouwvariant wordt zonder aanpassing behouden."),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/phase4-project-journal.png",
    fullPage: true,
  })
  await page.getByRole("link", { name: "Open topicdossier" }).first().click()

  await page.getByRole("button", { name: "Topic afsluiten" }).click()
  await expect(page.locator(".topic-detail__header")).toContainText(
    "Afgesloten",
  )
  await page.getByRole("button", { name: "Topic heropenen" }).click()
  await expect(page.locator(".topic-detail__header")).toContainText("Open")

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase4-topic-roundtrip.json",
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
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page.getByRole("searchbox", { name: "Zoeken" }).fill("TOP-F4-E2E")
  await page
    .getByRole("button", {
      name: "TOP-F4-E2E Medische validatie bouwfase openen",
    })
    .click()

  await expect(page.locator(".topic-detail__header")).toContainText("Open")
  await expect(
    page
      .locator(".topic-current")
      .getByText("De verpleegkundige looplijnen zijn nagekeken en akkoord."),
  ).toBeVisible()
  await expect(
    page
      .locator(".conversation-feed__entry")
      .filter({ hasText: "De verpleegkundige looplijnen" }),
  ).toContainText("E2E Update-auteur")
  await expect(
    page.getByText("De huidige bouwvariant wordt zonder aanpassing behouden."),
  ).toBeVisible()

  await page.setViewportSize({ width: 720, height: 900 })
  await page.screenshot({
    path: "test-results/phase4-topic-mobile.png",
    fullPage: true,
  })

  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole("button", { name: "Sessie herstellen" }).click()
  await expect(page).toHaveURL(/#\/projects\/.+\/topics\/.+$/)
  await expect(
    page.getByRole("heading", { name: "Medische validatie bouwfase" }),
  ).toBeVisible()
})
