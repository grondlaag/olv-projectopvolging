import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(90_000)

test("projectjournaal beheert topics en bijdragen volledig lokaal", async ({
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
  await page
    .getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    })
    .click()
  await expect(page.getByText("Actieve topics", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: /^Journaal/ }).click()

  await expect(
    page.getByRole("main", { name: "Projectjournaal" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: /Nieuw topic/ })
    .first()
    .click()
  await page.getByLabel("Titel nieuw topic").fill("Medische validatie bouwfase")
  await page.getByRole("button", { name: "Topic toevoegen" }).click()

  const topic = page.locator(".journal-topic").filter({
    hasText: "Medische validatie bouwfase",
  })
  await expect(topic).toBeVisible()
  await expect(topic.locator(".journal-topic__identity strong")).toHaveText(
    /^T-\d{3}$/,
  )

  const composer = topic.getByLabel(
    "Nieuwe bijdrage aan Medische validatie bouwfase",
  )
  await composer.fill(
    "De verpleegkundige **looplijnen** zijn nagekeken en akkoord.",
  )
  await composer.press("Enter")
  await expect(topic.getByText("looplijnen", { exact: true })).toBeVisible()

  await topic.getByLabel("Soort bijdrage").click()
  await topic.getByRole("menuitem", { name: "Actie" }).click()
  await composer.fill("Controleer de branddoorgang")
  await composer.press("Enter")
  await expect(
    topic.locator(".journal-entry__label--action").filter({ hasText: "Actie" }),
  ).toBeVisible()

  await topic.getByLabel("Soort bijdrage").click()
  await topic.getByRole("menuitem", { name: "Beslissing nodig" }).click()
  await composer.fill("Kan de huidige bouwvariant behouden blijven?")
  await composer.press("Enter")
  await expect(
    topic.locator(".journal-entry__label--decision_request"),
  ).toContainText("Beslissing nodig")

  await topic
    .getByRole("button", { name: /Inhoud van De verpleegkundige.*bewerken/ })
    .click()
  const inlineEditor = topic.getByLabel("Inhoud bewerken")
  await inlineEditor.fill(
    "De verpleegkundige **looplijnen** zijn definitief akkoord.",
  )
  await inlineEditor.press("Control+Enter")
  await expect(
    topic.getByText("definitief akkoord", { exact: false }),
  ).toBeVisible()

  await topic.locator(".journal-topic__header").click()
  let properties = page.getByRole("complementary", {
    name: "Topiceigenschappen",
  })
  await expect(properties.getByLabel("Titel")).toHaveValue(
    "Medische validatie bouwfase",
  )
  await properties.getByLabel("Status").selectOption("Afgesloten")
  await expect(page.getByText(/gesloten topics/)).toBeVisible()
  properties = page.getByRole("complementary", { name: "Topiceigenschappen" })
  await properties.getByLabel("Status").selectOption("Open")
  await expect(
    topic.getByLabel("Nieuwe bijdrage aan Medische validatie bouwfase"),
  ).toBeVisible()

  await page.screenshot({
    path: "test-results/phase4-project-journal.png",
    fullPage: true,
  })

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase4-journal-roundtrip.json",
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
  await page
    .getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    })
    .click()
  await page.getByRole("link", { name: /^Journaal/ }).click()
  const restoredTopic = page.locator(".journal-topic").filter({
    hasText: "Medische validatie bouwfase",
  })
  await expect(restoredTopic).toBeVisible()
  await expect(restoredTopic).toContainText("Controleer de branddoorgang")
  await expect(restoredTopic).toContainText(
    "Kan de huidige bouwvariant behouden blijven?",
  )

  await page.setViewportSize({ width: 720, height: 900 })
  await page.screenshot({
    path: "test-results/phase4-project-journal-mobile.png",
    fullPage: true,
  })
})
