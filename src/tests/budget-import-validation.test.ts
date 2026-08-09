// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import ExcelJS, { type CellValue } from "exceljs"
import { describe, expect, it } from "vitest"
import { BrowserExcelWorkbookGateway } from "../infrastructure/excel"

const fixturePath = resolve(
  process.cwd(),
  "src/tests/fixtures/excel/small-valid.xlsx",
)
const gateway = new BrowserExcelWorkbookGateway()

async function budgetFixture(
  changes: Readonly<Record<string, CellValue>>,
): Promise<ArrayBuffer> {
  const bytes = await readFile(fixturePath)
  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(source as never)
  const worksheet = workbook.getWorksheet("Budget")
  if (!worksheet) throw new Error("Budgetfixture ontbreekt.")
  const columns = new Map<string, number>()
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    columns.set(String(cell.value), columnNumber)
  })
  for (const [header, value] of Object.entries(changes)) {
    const columnNumber = columns.get(header)
    if (!columnNumber) throw new Error(`Kolom ${header} ontbreekt.`)
    worksheet.getRow(2).getCell(columnNumber).value = value
  }
  const written = await workbook.xlsx.writeBuffer()
  const result = new Uint8Array(written)
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength,
  ) as ArrayBuffer
}

async function issueCodes(changes: Readonly<Record<string, CellValue>>) {
  const imported = await gateway.importBuffer(
    await budgetFixture(changes),
    "budget-invalid.xlsx",
  )
  expect(imported.hasBlockingIssues).toBe(true)
  return imported.issues.map((issue) => issue.code)
}

describe("strikte budgetimportvalidatie", () => {
  it("blokkeert een niet-numeriek bedrag", async () => {
    expect(await issueCodes({ bedrag: "niet-numeriek" })).toContain(
      "excel.budget.invalid",
    )
  })

  it("blokkeert een onbekend project", async () => {
    expect(
      await issueCodes({
        "project-guid": "ffffffff-ffff-4fff-8fff-fffffffffff1",
      }),
    ).toContain("excel.relation.budget")
  })

  it("blokkeert een topic uit een ander project", async () => {
    expect(
      await issueCodes({
        "project-guid": "50000000-0000-4000-8000-000000000002",
      }),
    ).toContain("excel.relation.budget")
  })

  it("blokkeert een onbekende leverancieractor", async () => {
    expect(
      await issueCodes({
        "leverancier-actor-guid": "ffffffff-ffff-4fff-8fff-fffffffffff2",
      }),
    ).toContain("excel.relation.actor")
  })

  it("blokkeert een ontbrekend type", async () => {
    expect(await issueCodes({ type: null })).toContain("excel.value.invalid")
  })

  it("blokkeert een ongeldige datum", async () => {
    expect(await issueCodes({ datum: "31/02/2026" })).toContain(
      "excel.date.invalid",
    )
  })
})
