import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"

async function assertAccessibleSurface(page: Page) {
  await expect(page.locator("main h1").first()).toBeVisible()
  const unnamedButtons = await page
    .locator("button:visible")
    .evaluateAll(
      (buttons) =>
        buttons.filter(
          (button) =>
            !button.textContent?.trim() &&
            !button.getAttribute("aria-label") &&
            !button.getAttribute("title"),
        ).length,
    )
  const unlabelledFields = await page
    .locator(
      'input:visible:not([type="hidden"]), select:visible, textarea:visible',
    )
    .evaluateAll(
      (fields) =>
        fields.filter(
          (field) =>
            !(field as HTMLInputElement).labels?.length &&
            !field.getAttribute("aria-label") &&
            !field.getAttribute("aria-labelledby"),
        ).length,
    )
  const hasDocumentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const overflowSources = hasDocumentOverflow
    ? await page.locator("body *").evaluateAll((elements) =>
        elements
          .map((element) => ({
            element: `${element.tagName.toLocaleLowerCase()}${element.className ? `.${String(element.className).replaceAll(" ", ".")}` : ""}`,
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width),
          }))
          .filter((item) => item.right > window.innerWidth + 1)
          .slice(0, 8),
      )
    : []
  expect(unnamedButtons).toBe(0)
  expect(unlabelledFields).toBe(0)
  expect(hasDocumentOverflow, JSON.stringify(overflowSources)).toBe(false)
  await expect(page.getByRole("button", { name: "JSON opslaan" })).toBeVisible()
}

test("fase 9 productiepreview blijft rustig, responsive en toetsenbordbruikbaar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto("/#/dashboard")
  await page.getByRole("button", { name: "JSON openen", exact: true }).click()
  const importDialog = page.getByRole("dialog", {
    name: "JSON-gegevensbestand",
  })
  await expect
    .poll(() =>
      importDialog.evaluate((dialog) =>
        dialog.contains(document.activeElement),
      ),
    )
    .toBe(true)
  await importDialog
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), "src/tests/fixtures/json/small-valid.json"),
    )
  await expect(importDialog.getByText("Blocking: 0")).toBeVisible()
  await importDialog.getByRole("button", { name: "Bestand openen" }).click()
  await assertAccessibleSurface(page)
  await page.screenshot({
    path: "test-results/phase9-visual-1920-dashboard.png",
    fullPage: true,
  })

  const skipLink = page.getByRole("button", { name: "Ga naar inhoud" })
  await skipLink.focus()
  await expect(skipLink).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("#main-content")).toBeFocused()

  await page.keyboard.press("Control+K")
  const globalSearch = page.getByRole("combobox", { name: "Globaal zoeken" })
  await expect(globalSearch).toBeFocused()
  await globalSearch.fill("PRJ-001")
  await expect(page.getByRole("listbox")).toBeVisible()
  await globalSearch.press("Enter")
  await expect(
    page.getByRole("heading", { name: "Synthetisch renovatieproject" }),
  ).toBeVisible()
  const projectRoute = `/${new URL(page.url()).hash}`
  await page.getByRole("link", { name: /^Topics/ }).click()
  await page
    .getByRole("button", { name: /TOP-001 Tijdelijke toegang openen/ })
    .click()
  const topicRoute = `/${new URL(page.url()).hash}`

  const surfaces = [
    {
      width: 1440,
      name: "portfolio",
      route: "/#/portfolio",
      heading: "Portfolio",
    },
    {
      width: 1280,
      name: "project",
      route: projectRoute,
      heading: "Synthetisch renovatieproject",
    },
    {
      width: 1024,
      name: "topic",
      route: topicRoute,
      heading: "Tijdelijke toegang",
      level: 2,
    },
    {
      width: 768,
      name: "actions",
      route: "/#/actions",
      heading: "Acties",
    },
    {
      width: 1280,
      name: "planning",
      route: "/#/planning",
      heading: "Planning",
    },
    {
      width: 1024,
      name: "budget",
      route: "/#/budget",
      heading: "Budget",
    },
    {
      width: 768,
      name: "meetings",
      route: "/#/meetings",
      heading: "Overleg",
    },
  ] as const

  for (const surface of surfaces) {
    await page.setViewportSize({ width: surface.width, height: 1000 })
    await page.goto(surface.route)
    await expect(
      page.getByRole("heading", {
        level: "level" in surface ? surface.level : 1,
        name: surface.heading,
      }),
    ).toBeVisible()
    await assertAccessibleSurface(page)
    await page.screenshot({
      path: `test-results/phase9-visual-${surface.width}-${surface.name}.png`,
      fullPage: true,
    })
  }

  await page.setViewportSize({ width: 1024, height: 1000 })
  await page.goto(topicRoute)
  const composer = page.getByRole("form", {
    name: /Bijdrage toevoegen aan/,
  })
  await expect(composer).toBeVisible()
  await expect(
    composer.getByRole("button", { name: "Beslissing" }),
  ).toBeVisible()
})
