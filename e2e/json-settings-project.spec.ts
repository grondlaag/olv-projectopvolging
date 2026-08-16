import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("nieuwe JSON-set ondersteunt instellingen en inline hoofdstuk en cluster", async ({
  page,
}) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  let dialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await dialog.getByRole("button", { name: "Nieuwe gegevensset" }).click()
  await expect(dialog.getByText("Blocking: 0")).toBeVisible()
  await dialog.getByRole("button", { name: "Gegevensset starten" }).click()

  await expect(
    page.getByRole("heading", { name: "Instellingen", exact: true }),
  ).toBeVisible()
  await page.getByRole("tab", { name: "Hoofdstukken en clusters" }).click()
  await expect(
    page.getByRole("heading", { name: "Hoofdstukken" }),
  ).toBeVisible()
  await expect(page.getByText("H1 · Gebouw en ruimte")).toBeVisible()
  await page.screenshot({
    path: "test-results/json-settings-page.png",
    fullPage: true,
  })

  await page.getByRole("link", { name: "Portfolio" }).click()
  await page.getByRole("button", { name: "+ Nieuw project" }).click()
  await page.getByLabel("Projectcode").fill("PRJ-JSON-01")
  await page.getByLabel("Titel").fill("JSON beheerproef")
  await page
    .getByLabel("Omschrijving")
    .fill("Project met inline structuurbeheer.")
  await page.getByLabel("Fase").fill("Initiatie")

  await page.getByRole("button", { name: "+ Nieuw hoofdstuk" }).click()
  dialog = page.getByRole("dialog", { name: "Nieuw hoofdstuk" })
  await dialog.getByLabel("Hoofdstukcode").fill("H9")
  await dialog.getByLabel("Hoofdstuktitel").fill("Digitale werkplek")
  await dialog.getByRole("button", { name: "Hoofdstuk opslaan" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel("Hoofdstuk")).not.toHaveValue("")

  await page.getByRole("button", { name: "+ Nieuwe cluster" }).click()
  dialog = page.getByRole("dialog", { name: "Nieuwe cluster" })
  await dialog.getByLabel("Clustercode").fill("CL-DIG")
  await dialog.getByLabel("Clusternaam").fill("Digitale werkplek")
  await dialog.getByRole("button", { name: "Cluster opslaan" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel("Cluster (optioneel)")).not.toHaveValue("")
  await page.screenshot({
    path: "test-results/json-project-form.png",
    fullPage: true,
  })

  await page.getByRole("button", { name: "Project opslaan" }).click()
  await expect(
    page.getByRole("heading", { name: "JSON beheerproef" }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const exportedPath = resolve(
    process.cwd(),
    "test-results/json-settings-project-roundtrip.json",
  )
  await (await downloadPromise).saveAs(exportedPath)

  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "JSON-gegevensbestand" })
  await dialog.locator('input[type="file"]').setInputFiles(exportedPath)
  await expect(dialog.getByText("Blocking: 0")).toBeVisible()
  await dialog.getByRole("button", { name: "Bestand openen" }).click()
  await expect(page).toHaveURL(/#\/dashboard$/u)
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Portfolio" })
    .click()
  await page.getByLabel("Zoekterm").fill("PRJ-JSON-01")
  await expect(
    page.getByRole("button", { name: "PRJ-JSON-01 JSON beheerproef openen" }),
  ).toBeVisible()
})
