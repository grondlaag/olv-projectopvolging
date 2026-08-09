import type { CellValue, Table, Worksheet } from "exceljs"
import {
  createEmptyDomainCollections,
  normalizeDomainState,
  type NormalizedDomainState,
} from "../../../application/services"
import type { UUID } from "../../../domain"
import { ExcelValidationService } from "../excel-validation-service"
import { ExcelMigrationService } from "../migrations"
import { excelSchema, getExcelJsTableModel, readExcelTable } from "../schema"
import { ExcelSchemaInspector } from "../schema/excel-schema-inspector"
import { ValidationReport } from "../validation-report"
import type { LoadedExcelWorkbook, WorkbookInspection } from "../workbook-types"
import { ExcelRowMapper } from "./excel-row-mapper"
import { ExcelReferentialValidator } from "./referential-validator"

export interface ExcelImportOptions {
  repairMode?: boolean
}

export interface ExcelImportResult {
  state: NormalizedDomainState
  inspection: WorkbookInspection
  report: ValidationReport
  sourceBuffer: ArrayBuffer
  fileName: string
}

function worksheetTables(worksheet: Worksheet): readonly Table[] {
  return worksheet.getTables() as unknown as Table[]
}

export class ExcelImporter {
  constructor(
    private readonly inspector = new ExcelSchemaInspector(),
    private readonly validationService = new ExcelValidationService(),
    private readonly migrationService = new ExcelMigrationService(),
    private readonly rowMapper = new ExcelRowMapper(),
    private readonly referentialValidator = new ExcelReferentialValidator(),
  ) {}

  import(
    loaded: LoadedExcelWorkbook,
    options: ExcelImportOptions = {},
  ): ExcelImportResult {
    const inspection = this.inspector.inspect(loaded.workbook)
    const report = this.validationService.validateInspection(
      inspection,
      loaded.format,
    )
    const migration = this.migrationService.plan(inspection.schemaVersion)
    if (migration.required && !migration.supported) {
      report.add({
        level: "Blocking",
        code: "excel.migration.unsupported",
        message: `Schema ${inspection.schemaVersion ?? "onbekend"} kan niet automatisch naar ${migration.targetVersion} worden gemigreerd.`,
      })
    }

    const records = createEmptyDomainCollections()
    const seenIds = new Map<UUID, string>()

    for (const definition of excelSchema.tables) {
      const worksheet = loaded.workbook.worksheets.find((candidate) =>
        worksheetTables(candidate).some(
          (table) => getExcelJsTableModel(table).name === definition.tableName,
        ),
      )
      const table = worksheet
        ? worksheetTables(worksheet).find(
            (candidate) =>
              getExcelJsTableModel(candidate).name === definition.tableName,
          )
        : undefined
      if (!table || !worksheet) continue
      const tableData = readExcelTable(worksheet, table)

      for (const [rowIndex, row] of tableData.rows.entries()) {
        const mapped = this.rowMapper.map(
          tableData.columns,
          definition,
          row as CellValue[],
          rowIndex + 2,
          options.repairMode ?? false,
        )
        report.addMany(mapped.issues)
        if (!mapped.entity) continue

        const id = mapped.entity.id as UUID
        const previousTable = seenIds.get(id)
        if (previousTable) {
          report.add({
            level: "Blocking",
            code: "excel.guid.duplicate",
            tableName: definition.tableName,
            rowNumber: rowIndex + 2,
            columnName: "guid",
            message: `GUID ${id} bestaat al in ${previousTable}.`,
          })
          continue
        }
        seenIds.set(id, definition.tableName)

        ;(records[definition.collection] as unknown[]).push(mapped.entity)
      }
    }

    report.addMany(this.referentialValidator.validate(records))
    return {
      state: normalizeDomainState(records),
      inspection,
      report,
      sourceBuffer: loaded.sourceBuffer.slice(0),
      fileName: loaded.fileName,
    }
  }
}
