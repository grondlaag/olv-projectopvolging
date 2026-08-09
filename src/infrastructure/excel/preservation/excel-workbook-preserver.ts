import ExcelJS from "exceljs"
import type { Workbook, Worksheet } from "exceljs"
import { excelSchema } from "../schema"
import { getExcelJsTableModel } from "../schema/excel-table-reader"

function containsManagedTable(worksheet: Worksheet): boolean {
  const managedTables = new Set(
    excelSchema.tables.map((table) => table.tableName),
  )
  const tables = worksheet.getTables() as unknown as import("exceljs").Table[]
  return tables.some((table) =>
    managedTables.has(getExcelJsTableModel(table).name),
  )
}

export interface PreservedWorkbook {
  workbook: Workbook
  warnings: readonly string[]
}

export class ExcelWorkbookPreserver {
  async prepare(sourceBuffer?: ArrayBuffer): Promise<PreservedWorkbook> {
    if (!sourceBuffer) {
      return { workbook: new ExcelJS.Workbook(), warnings: [] }
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(sourceBuffer as never)
    const managedWorksheetNames = new Set(
      excelSchema.tables.map((table) => table.worksheetName),
    )
    const worksheetsToReplace = workbook.worksheets.filter(
      (worksheet) =>
        managedWorksheetNames.has(worksheet.name) ||
        containsManagedTable(worksheet),
    )

    for (const worksheet of worksheetsToReplace) {
      workbook.removeWorksheet(worksheet.id)
    }

    return {
      workbook,
      warnings: [
        "Onbekende werkbladen zijn best-effort behouden; VBA, shapes, pivots, externe koppelingen en complexe stijlen worden niet gegarandeerd roundtripbaar bewaard.",
      ],
    }
  }
}
