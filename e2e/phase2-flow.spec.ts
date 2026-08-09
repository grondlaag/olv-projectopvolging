import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("fase-2-hoofdflow werkt volledig lokaal en herstelt de projectroute", async ({
  page,
}) => {
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "Excelbestand laden" }).click()
  const dialog = page.getByRole("dialog", { name: "Excelbestand laden" })
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/excel/small-valid.xlsx"),
    )

  await expect(dialog.getByText("Importcontrole")).toBeVisible()
  await expect(dialog.getByText("Blocking: 0")).toBeVisible()
  await dialog.getByRole("button", { name: "Import bevestigen" }).click()

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(
    page.getByText("small-valid.xlsx", { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/phase2-dashboard.png",
    fullPage: true,
  })
  await page.getByRole("link", { name: "Portfolio" }).click()

  await page.screenshot({
    path: "test-results/phase2-portfolio.png",
    fullPage: true,
  })

  const search = page.getByLabel("Zoekterm")
  await search.fill("PRJ-001")
  await expect(
    page.getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    }),
  ).toBeVisible()
  await page
    .getByRole("button", {
      name: "PRJ-001 Synthetisch renovatieproject openen",
    })
    .click()

  await expect(page).toHaveURL(
    /#\/projects\/50000000-0000-4000-8000-000000000001$/,
  )
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()

  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole("button", { name: "Sessie herstellen" }).click()

  await expect(page).toHaveURL(
    /#\/projects\/50000000-0000-4000-8000-000000000001$/,
  )
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()
})
