import type { Workbook } from "exceljs"

export type ExcelFileFormat = "xlsx" | "xlsm"

export interface LoadedExcelWorkbook {
  workbook: Workbook
  sourceBuffer: ArrayBuffer
  fileName: string
  format: ExcelFileFormat
}

export interface InspectedExcelTable {
  name: string
  worksheetName: string
  columns: readonly string[]
  rowCount: number
  known: boolean
}

export interface WorkbookInspection {
  worksheetNames: readonly string[]
  tables: readonly InspectedExcelTable[]
  foundTables: readonly string[]
  missingTables: readonly string[]
  unknownTables: readonly string[]
  unknownWorksheets: readonly string[]
  schemaVersion?: string
}
