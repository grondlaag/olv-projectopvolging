import type { ExcelFileFormat, WorkbookInspection } from "./workbook-types"
import { excelTableByName } from "./schema"
import { ValidationReport } from "./validation-report"

const auditHeaders = new Set([
  "datum-aangemaakt",
  "aangemaakt-door-guid",
  "datum-gewijzigd",
  "gewijzigd-door-guid",
  "actief",
])

export class ExcelValidationService {
  validateInspection(
    inspection: WorkbookInspection,
    format: ExcelFileFormat,
  ): ValidationReport {
    const report = new ValidationReport()

    for (const table of inspection.tables) {
      report.add({
        level: "Info",
        code: "excel.table.found",
        tableName: table.name,
        message: `${table.name}: ${table.rowCount} record(s) gevonden.`,
      })

      const definition = excelTableByName.get(table.name)
      if (!definition) continue

      for (const expectedColumn of definition.columns) {
        if (table.columns.includes(expectedColumn.header)) continue
        report.add({
          level: expectedColumn.optional ? "Warning" : "Blocking",
          code: auditHeaders.has(expectedColumn.header)
            ? "excel.audit-column.missing"
            : "excel.column.missing",
          tableName: table.name,
          columnName: expectedColumn.header,
          message: `Kolom ${expectedColumn.header} ontbreekt in ${table.name}.`,
        })
      }
    }

    for (const tableName of inspection.missingTables) {
      report.add({
        level: "Blocking",
        code: "excel.table.missing",
        tableName,
        message: `Verplichte tabel ${tableName} ontbreekt.`,
      })
    }

    for (const tableName of inspection.unknownTables) {
      report.add({
        level: "Warning",
        code: "excel.table.unknown",
        tableName,
        message: `Onbekende tabel ${tableName} wordt niet als domeindata geïmporteerd.`,
      })
    }

    for (const worksheetName of inspection.unknownWorksheets) {
      report.add({
        level: "Info",
        code: "excel.worksheet.preserved",
        message: `Onbekend werkblad ${worksheetName} wordt best-effort behouden.`,
      })
    }

    if (!inspection.schemaVersion) {
      report.add({
        level: "Blocking",
        code: "excel.schema-version.missing",
        message: "Schema-versie ontbreekt in tblConfig.",
      })
    }

    if (format === "xlsm") {
      report.add({
        level: "Warning",
        code: "excel.xlsm.best-effort",
        message:
          "Dit .xlsm-bestand wordt best-effort gelezen; VBA, shapes, pivots en externe koppelingen worden niet gegarandeerd behouden.",
      })
    }

    return report
  }
}
