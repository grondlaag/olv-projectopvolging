import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("de tijdelijke Excel-harness bewijst de browser-roundtrip", async ({
  page,
}) => {
  await page.goto("/#/dev/excel")
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/excel/small-valid.xlsx"),
    )

  await expect(
    page.getByRole("heading", { name: "Excel roundtrip" }),
  ).toBeVisible()
  await expect(
    page.locator("#main-content").getByText("small-valid.xlsx"),
  ).toBeVisible()
  await expect(page.getByText("tblProjecten", { exact: true })).toBeVisible()
  await expect(page.getByText("Blocking: 0")).toBeVisible()

  const firstProject = page.getByLabel("PRJ-001")
  await firstProject.fill("Gewijzigd in de browser")
  await firstProject.blur()
  await page.getByRole("button", { name: "Export herimporteren" }).click()

  await expect(page.getByText("Semantisch identiek")).toBeVisible()
})
