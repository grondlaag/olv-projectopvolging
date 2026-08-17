import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test.setTimeout(150_000)

test("fase-7-hoofdflow beheert budget, correctiehistorie en JSON-roundtrip lokaal", async ({
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
  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: "Budget" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()

  const addBudgetItem = async (input: {
    type: string
    status: string
    description: string
    amount: string
    topic?: string
  }) => {
    await page.getByRole("button", { name: "+ Budgetitem" }).click()
    const panel = page.getByRole("dialog", { name: "Budgetitem toevoegen" })
    await panel.getByLabel("Type").selectOption(input.type)
    await panel.getByText("Meer opties", { exact: true }).click()
    await panel.getByLabel("Status").selectOption(input.status)
    await panel.getByLabel("Categorie").fill("Fase 7 E2E")
    await panel.getByLabel("Bedrag").fill(input.amount)
    await panel.getByLabel("Datum").fill("2026-08-09")
    await panel.getByLabel("Omschrijving").fill(input.description)
    if (input.topic) {
      await panel.getByLabel("Topic").selectOption({ label: input.topic })
    }
    await panel.getByRole("button", { name: "Budgetitem opslaan" }).click()
    await expect(
      page.getByText(
        "Budgetitem opgeslagen in de lokale sessie · back-up nodig",
      ),
    ).toBeVisible()
  }

  await addBudgetItem({
    type: "Goedgekeurd budget",
    status: "Goedgekeurd",
    description: "E2E goedgekeurd budget",
    amount: "1.000.000,00",
  })
  await addBudgetItem({
    type: "Raming",
    status: "Verwacht",
    description: "E2E actuele raming",
    amount: "1.100.000,00",
  })
  await addBudgetItem({
    type: "Contract",
    status: "Vastgelegd",
    description: "E2E hoofdcontract",
    amount: "800.000,00",
  })
  await addBudgetItem({
    type: "Meerwerk",
    status: "Vastgelegd",
    description: "E2E topicgekoppeld meerwerk",
    amount: "25.000,00",
    topic: "TOP-001 · Tijdelijke toegang",
  })

  await expect(page.getByText("E2E goedgekeurd budget")).toBeVisible()
  await expect(page.getByText("E2E actuele raming")).toBeVisible()
  await expect(page.getByText("E2E hoofdcontract")).toBeVisible()
  await expect(page.getByText("E2E topicgekoppeld meerwerk")).toBeVisible()
  await expect(
    page.getByText("€ 25.000,00", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByText("Kerncijfers wachten op een besliste rekenregel."),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/phase7-project-budget.png",
    fullPage: true,
  })

  await page
    .getByRole("navigation", { name: "Projectdossierweergave" })
    .getByRole("link", { name: /^Topics/ })
    .click()
  await page.getByText("Budgetimpact", { exact: true }).click()
  await expect(page.getByText("2 gekoppelde records")).toBeVisible()
  await page.getByRole("link", { name: "Bekijk budgetitems" }).click()
  await expect(page.getByText("E2E topicgekoppeld meerwerk")).toBeVisible()

  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("link", { name: "Budget" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Budget", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("region", { name: "Filters" })
    .getByText("Filters", { exact: true })
    .click()
  await page
    .getByLabel("Projectfilter")
    .selectOption({ label: "PRJ-001 · Synthetisch renovatieproject" })
  await page.getByText("H1 · Gebouw en ruimte", { exact: true }).click()
  await page.locator("summary").filter({ hasText: "Zorgcampus" }).click()
  await expect(
    page.getByRole("link", {
      name: "PRJ-001 · Synthetisch renovatieproject",
      exact: true,
    }),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/phase7-portfolio-budget.png",
    fullPage: true,
  })
  await page
    .getByRole("link", {
      name: "PRJ-001 · Synthetisch renovatieproject",
      exact: true,
    })
    .click()

  const approvedRow = page
    .getByRole("row")
    .filter({ hasText: "E2E goedgekeurd budget" })
  await approvedRow.getByRole("button", { name: "Corrigeren" }).click()
  let panel = page.getByRole("dialog", { name: "Bedrag corrigeren" })
  await panel.getByLabel("Nieuw bedrag").fill("950.000,00")
  await panel
    .getByLabel("Reden")
    .fill("E2E foutcorrectie van het ingelezen bedrag.")
  await panel.getByRole("button", { name: "Correctie opslaan" }).click()
  await expect(
    page.getByText("Foutcorrectie opgeslagen met historie · back-up nodig"),
  ).toBeVisible()
  await approvedRow.getByRole("button", { name: "Corrigeren (1)" }).click()
  panel = page.getByRole("dialog", { name: "Bedrag corrigeren" })
  await expect(
    panel.getByText("E2E foutcorrectie van het ingelezen bedrag."),
  ).toBeVisible()
  await panel.getByRole("button", { name: "Sluiten" }).click()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "JSON opslaan" }).click()
  const download = await downloadPromise
  const exportedPath = resolve(
    process.cwd(),
    "test-results/phase7-budget-roundtrip.json",
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
    .getByRole("link", { name: "Budget" })
    .click()
  await expect(page.getByText("E2E goedgekeurd budget")).toBeVisible()
  await expect(approvedRow.getByText(/€\s?950\.000,00/)).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: "E2E topicgekoppeld meerwerk" }),
  ).toContainText("TOP-001 · Tijdelijke toegang")
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "E2E goedgekeurd budget" })
      .getByRole("button", { name: "Corrigeren (1)" }),
  ).toBeVisible()
})
