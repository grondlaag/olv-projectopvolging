import type { Table, Workbook, Worksheet } from "exceljs"
import { excelSchema, excelTableByName } from "./excel-schema"
import { readExcelTable } from "./excel-table-reader"
import type { InspectedExcelTable, WorkbookInspection } from "../workbook-types"

function worksheetTables(worksheet: Worksheet): readonly Table[] {
  return worksheet.getTables() as unknown as Table[]
}

function scalar(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "object") {
    if ("result" in value) return scalar(value.result)
    if ("text" in value && typeof value.text === "string") return value.text
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) =>
          typeof part === "object" && part && "text" in part
            ? String(part.text)
            : "",
        )
        .join("")
    }
  }
  return String(value)
}

function inspectTable(worksheet: Worksheet, table: Table): InspectedExcelTable {
  const data = readExcelTable(worksheet, table)
  return {
    name: data.name,
    worksheetName: worksheet.name,
    columns: data.columns,
    rowCount: data.rows.length,
    known: excelTableByName.has(data.name),
  }
}

function readSchemaVersion(workbook: Workbook): string | undefined {
  for (const worksheet of workbook.worksheets) {
    for (const table of worksheetTables(worksheet)) {
      const data = readExcelTable(worksheet, table)
      if (data.name !== "tblConfig") continue
      const columnIndex = data.columns.findIndex(
        (item) => item === "schema-versie",
      )
      if (columnIndex < 0 || data.rows.length === 0) return undefined
      return scalar(data.rows[0]?.[columnIndex])
    }
  }
  return undefined
}

export class ExcelSchemaInspector {
  inspect(workbook: Workbook): WorkbookInspection {
    const tables = workbook.worksheets.flatMap((worksheet) =>
      worksheetTables(worksheet).map((table) => inspectTable(worksheet, table)),
    )
    const foundTables = tables.map((table) => table.name)
    const managedWorksheets = new Set(
      excelSchema.tables.map((table) => table.worksheetName),
    )
    const schemaVersion = readSchemaVersion(workbook)

    return {
      worksheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
      tables,
      foundTables,
      missingTables: excelSchema.tables
        .filter(
          (definition) =>
            definition.required && !foundTables.includes(definition.tableName),
        )
        .map((definition) => definition.tableName),
      unknownTables: tables
        .filter((table) => !table.known)
        .map((table) => table.name),
      unknownWorksheets: workbook.worksheets
        .filter((worksheet) => !managedWorksheets.has(worksheet.name))
        .map((worksheet) => worksheet.name),
      ...(schemaVersion ? { schemaVersion } : {}),
    }
  }
}
