import { expect, test } from "@playwright/test"

test("hashroutes werken in de productiebuild", async ({ page }) => {
  await page.goto("/#/portfolio")

  await expect(
    page.getByRole("heading", { name: "Portfolio", exact: true }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Dashboard" }).click()
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible()
})

test("de technische navigatie blijft bruikbaar op een smal scherm", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto("/#/portfolio")

  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" }),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Portfolio" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Budget" })).toBeVisible()
})
