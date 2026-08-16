import type { CellValue, Workbook, Worksheet } from "exceljs"
import {
  cloneDomainCollections,
  createEmptyDomainCollections,
  normalizeDomainState,
  type DomainCollections,
  type NormalizedDomainState,
} from "../../../application/services"
import type { Config, DateTime, UUID } from "../../../domain"
import { ExcelReferentialValidator } from "../import"
import { ExcelWorkbookPreserver } from "../preservation"
import {
  EXCEL_SCHEMA_VERSION,
  excelSchema,
  type ExcelColumnDefinition,
  type ExcelTableDefinition,
} from "../schema"
import { ValidationReport } from "../validation-report"

export interface ExcelExportOptions {
  sourceBuffer?: ArrayBuffer
  fileName?: string
}

export interface ExcelExportResult {
  buffer: ArrayBuffer
  blob: Blob
  fileName: string
  report: ValidationReport
  preservationWarnings: readonly string[]
}

function getPath(source: object, path: string): unknown {
  let cursor: unknown = source
  for (const part of path.split(".")) {
    if (!cursor || typeof cursor !== "object") return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

function localDateToDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
}

function exportCellValue(
  value: unknown,
  column: ExcelColumnDefinition,
): CellValue {
  if (value === undefined || value === null) return null
  if (column.kind === "localDate") return localDateToDate(String(value))
  if (column.kind === "money") return Number(value) / 100
  return value as CellValue
}

function columnWidth(column: ExcelColumnDefinition): number {
  if (column.kind === "uuid") return 39
  if (column.kind === "dateTime") return 27
  if (column.kind === "localDate") return 14
  if (column.kind === "money") return 16
  if (column.path.toLowerCase().includes("description")) return 36
  if (column.path.toLowerCase().includes("title")) return 30
  return Math.min(28, Math.max(12, column.header.length + 2))
}

function writeManagedTable(
  workbook: Workbook,
  definition: ExcelTableDefinition,
  records: readonly object[],
): void {
  const worksheet = workbook.addWorksheet(definition.worksheetName, {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  const rows = records.map((record) =>
    definition.columns.map((column) =>
      exportCellValue(getPath(record, column.path), column),
    ),
  )

  worksheet.addTable({
    name: definition.tableName,
    displayName: definition.tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: definition.columns.map((item) => ({ name: item.header })),
    rows,
  })

  for (const [index, column] of definition.columns.entries()) {
    const worksheetColumn = worksheet.getColumn(index + 1)
    worksheetColumn.width = columnWidth(column)
    if (column.kind === "localDate") worksheetColumn.numFmt = "yyyy-mm-dd"
    if (column.kind === "money")
      worksheetColumn.numFmt = "#,##0.00;[Red]-#,##0.00"
    if (column.kind === "uuid") worksheetColumn.numFmt = "@"
  }

  styleWorksheet(worksheet, definition.columns.length)
}

function styleWorksheet(worksheet: Worksheet, columnCount: number): void {
  const header = worksheet.getRow(1)
  header.height = 24
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF006B5A" },
  }
  header.alignment = { vertical: "middle", horizontal: "left" }
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: columnCount },
  }
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value.slice(0)
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer
}

function localTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`
}

export function createExcelFileName(date = new Date()): string {
  return `OLV_Projectopvolging_${localTimestamp(date)}.xlsx`
}

function createConfig(): Config {
  const now = new Date().toISOString() as DateTime
  const id = crypto.randomUUID() as UUID
  return {
    id,
    schemaVersion: EXCEL_SCHEMA_VERSION,
    dataSetId: crypto.randomUUID() as UUID,
    createdAt: now,
    appVersion: "1.0.0",
    defaultCurrency: "EUR",
    audit: {
      createdAt: now,
      updatedAt: now,
      active: true,
    },
  }
}

export class ExcelExporter {
  constructor(
    private readonly preserver = new ExcelWorkbookPreserver(),
    private readonly referentialValidator = new ExcelReferentialValidator(),
  ) {}

  async export(
    state: NormalizedDomainState,
    options: ExcelExportOptions = {},
  ): Promise<ExcelExportResult> {
    const report = new ValidationReport()
    report.addMany(this.referentialValidator.validate(state.records))
    this.validateUniqueIds(state.records, report)
    if (report.hasBlockingIssues) {
      throw new Error("Export geblokkeerd door ongeldige domeindata.")
    }

    const records = cloneDomainCollections(state.records)
    if (records.config.length === 0) records.config.push(createConfig())
    for (const config of records.config) {
      config.schemaVersion = EXCEL_SCHEMA_VERSION
    }

    const preserved = await this.preserver.prepare(options.sourceBuffer)
    for (const definition of excelSchema.tables) {
      writeManagedTable(
        preserved.workbook,
        definition,
        records[definition.collection],
      )
    }

    preserved.workbook.creator = "OLV Projectopvolging"
    preserved.workbook.modified = new Date()
    preserved.workbook.calcProperties.fullCalcOnLoad = false
    const written = await preserved.workbook.xlsx.writeBuffer()
    const buffer = toArrayBuffer(written)
    return {
      buffer,
      blob: new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName: options.fileName ?? createExcelFileName(),
      report,
      preservationWarnings: preserved.warnings,
    }
  }

  async exportEmptyTemplate(): Promise<ExcelExportResult> {
    const records = createEmptyDomainCollections()
    records.config.push(createConfig())
    return this.export(normalizeDomainState(records), {
      fileName: "OLV_Projectopvolging_leeg_sjabloon.xlsx",
    })
  }

  exportBackup(
    sourceBuffer: ArrayBuffer,
    sourceFileName: string,
  ): ExcelExportResult {
    const buffer = sourceBuffer.slice(0)
    const baseName = sourceFileName.replace(/\.(xlsx|xlsm)$/i, "")
    return {
      buffer,
      blob: new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName: `${baseName}_backup_${localTimestamp(new Date())}.xlsx`,
      report: new ValidationReport(),
      preservationWarnings: [],
    }
  }

  private validateUniqueIds(
    records: DomainCollections,
    report: ValidationReport,
  ): void {
    const seen = new Set<UUID>()
    for (const definition of excelSchema.tables) {
      for (const record of records[definition.collection]) {
        if (seen.has(record.id)) {
          report.add({
            level: "Blocking",
            code: "excel.guid.duplicate",
            tableName: definition.tableName,
            message: `GUID ${record.id} komt meer dan één keer voor.`,
          })
        }
        seen.add(record.id)
      }
    }
  }
}
