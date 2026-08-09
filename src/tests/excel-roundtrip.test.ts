// @vitest-environment node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { ExcelWorkbookService } from "../application/services"
import type { UUID } from "../domain"
import {
  BrowserExcelWorkbookGateway,
  ExcelWorkbookLoader,
} from "../infrastructure/excel"

const fixtureDirectory = resolve(process.cwd(), "src/tests/fixtures/excel")
const gateway = new BrowserExcelWorkbookGateway()

async function fixture(name: string): Promise<ArrayBuffer> {
  const bytes = await readFile(resolve(fixtureDirectory, name))
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

async function importFixture(name: string, repairMode = false) {
  return gateway.importBuffer(await fixture(name), name, repairMode)
}

async function mutateFixture(
  name: string,
  mutate: (workbook: ExcelJS.Workbook) => void,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await fixture(name)) as never)
  mutate(workbook)
  const written = await workbook.xlsx.writeBuffer()
  const bytes = new Uint8Array(written)
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function issueCodes(session: Awaited<ReturnType<typeof importFixture>>) {
  return session.issues.map((issue) => issue.code)
}

describe("Excel import, export en semantische roundtrip", () => {
  it("importeert een leeg geldig werkboek met alle 22 beheerde tabellen", async () => {
    const session = await importFixture("empty-valid.xlsx")

    expect(session.hasBlockingIssues).toBe(false)
    expect(session.tables.filter((table) => table.known)).toHaveLength(22)
    expect(session.missingTables).toEqual([])
    expect(session.schemaVersion).toBe("1.0.0")
    expect(session.state.records.config).toHaveLength(1)
  })

  it("importeert een klein geldig werkboek naar genormaliseerde state en indices", async () => {
    const session = await importFixture("small-valid.xlsx")

    expect(session.hasBlockingIssues).toBe(false)
    expect(session.state.records.projects).toHaveLength(2)
    expect(session.state.records.planning).toHaveLength(2)
    expect(session.state.indices.projectById.size).toBe(2)
    expect(
      session.state.indices.planningByTopic.get(
        session.state.records.topics[0]!.id,
      ),
    ).toHaveLength(1)
  })

  it("blokkeert een ontbrekende verplichte tabel", async () => {
    const buffer = await mutateFixture("small-valid.xlsx", (workbook) => {
      const worksheet = workbook.getWorksheet("Logboek")
      if (!worksheet) throw new Error("Logboek-fixture ontbreekt.")
      workbook.removeWorksheet(worksheet.id)
    })
    const session = await gateway.importBuffer(buffer, "missing-table.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(session.missingTables).toContain("tblLogboek")
    expect(issueCodes(session)).toContain("excel.table.missing")
  })

  it("blokkeert een dubbele GUID over records", async () => {
    const session = await importFixture("duplicate-guid.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(issueCodes(session)).toContain("excel.guid.duplicate")
  })

  it("blokkeert een verbroken project-hoofdstukrelatie", async () => {
    const session = await importFixture("broken-reference.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(issueCodes(session)).toContain("excel.relation.project-chapter")
  })

  it("blokkeert een topic met project én cluster als ouder", async () => {
    const session = await importFixture("invalid-topic-parent.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(issueCodes(session)).toContain("excel.topic.invalid-parent")
  })

  it("blokkeert een cyclus in planningafhankelijkheden", async () => {
    const session = await importFixture("planning-cycle.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(issueCodes(session)).toContain("excel.planning.cycle")
  })

  it("blokkeert budgetbedragen met meer dan twee decimalen", async () => {
    const session = await importFixture("invalid-budget.xlsx")

    expect(session.hasBlockingIssues).toBe(true)
    expect(issueCodes(session)).toContain("excel.budget.cent-precision")
  })

  it("behoudt datumwaarden en bedragen exact als LocalDate en integer cents", async () => {
    const session = await importFixture("small-valid.xlsx")

    expect(session.state.records.projects[0]?.startDate).toBe("2026-01-15")
    expect(session.state.records.projects[0]?.plannedEndDate).toBe("2026-12-31")
    expect(session.state.records.budgets[0]?.amountCents).toBe(12_345_678)
  })

  it("herstelt veilige witruimte alleen in repair mode en rapporteert dit", async () => {
    const buffer = await mutateFixture("small-valid.xlsx", (workbook) => {
      const worksheet = workbook.getWorksheet("Projecten")
      if (!worksheet) throw new Error("Projecten-fixture ontbreekt.")
      let titleColumn = 0
      worksheet.getRow(1).eachCell((cell, columnNumber) => {
        if (cell.value === "titel") titleColumn = columnNumber
      })
      if (!titleColumn) throw new Error("Titelkolom ontbreekt.")
      worksheet.getRow(2).getCell(titleColumn).value = "  Herstelde titel  "
    })
    const strict = await gateway.importBuffer(buffer, "whitespace.xlsx")
    const repaired = await gateway.importBuffer(buffer, "whitespace.xlsx", true)

    expect(strict.state.records.projects[0]?.title).toBe("  Herstelde titel  ")
    expect(repaired.state.records.projects[0]?.title).toBe("Herstelde titel")
    expect(issueCodes(repaired)).toContain("excel.whitespace.trimmed")
    expect(
      repaired.issues.find((issue) => issue.code === "excel.whitespace.trimmed")
        ?.repaired,
    ).toBe(true)
  })

  it("doorloopt import, wijziging, export, herimport en semantische vergelijking", async () => {
    const imported = await importFixture("small-valid.xlsx")
    const downloads: string[] = []
    const service = new ExcelWorkbookService(gateway, {
      download: (_blob, fileName) => downloads.push(fileName),
    })
    const projectId = imported.state.records.projects[0]!.id as UUID
    const changed = service.updateProjectTitle(
      imported.state,
      projectId,
      "Gewijzigde synthetische projecttitel",
    )

    const roundTrip = await service.verifyRoundTrip(
      changed,
      imported.sourceBuffer,
    )

    expect(roundTrip.reimported.hasBlockingIssues).toBe(false)
    expect(roundTrip.comparison).toEqual({ equal: true, differences: [] })
    expect(
      roundTrip.reimported.state.indices.projectById.get(projectId)?.title,
    ).toBe("Gewijzigde synthetische projecttitel")
    expect(roundTrip.reimported.state.records.budgets[0]?.amountCents).toBe(
      12_345_678,
    )
    expect(downloads).toEqual([])
  })

  it("behoudt een onbekend werkblad best-effort tijdens export", async () => {
    const imported = await importFixture("small-valid.xlsx")
    const exported = await gateway.export(imported.state, imported.sourceBuffer)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(exported.buffer as never)

    expect(workbook.getWorksheet("NietBeheerd")?.getCell("B5").value).toBe(
      "BEHOUD-MIJ-2026",
    )
    expect(exported.preservationWarnings).toHaveLength(1)
  })

  it("maakt een exacte, niet-gemuteerde backup van de bronbytes", async () => {
    const source = await fixture("small-valid.xlsx")
    const backup = gateway.exportBackup(source, "small-valid.xlsx")

    expect(backup.buffer.byteLength).toBe(source.byteLength)
    expect(
      Buffer.compare(Buffer.from(backup.buffer), Buffer.from(source)),
    ).toBe(0)
    expect(backup.fileName).toMatch(
      /^small-valid_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.xlsx$/,
    )
  })

  it("weigert andere bestandsformaten vóór parsing", async () => {
    const loader = new ExcelWorkbookLoader()

    await expect(
      loader.loadArrayBuffer(new ArrayBuffer(0), "data.csv"),
    ).rejects.toThrow("Selecteer een .xlsx- of .xlsm-bestand.")
  })
})
