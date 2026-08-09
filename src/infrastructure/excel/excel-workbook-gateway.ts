import type {
  ExcelWorkbookGateway,
  ExportedExcelWorkbook,
  ImportedExcelSession,
  NormalizedDomainState,
} from "../../application/services"
import { ExcelExporter } from "./export"
import { ExcelImporter } from "./import"
import { ExcelWorkbookLoader } from "./excel-workbook-loader"

export class BrowserExcelWorkbookGateway implements ExcelWorkbookGateway {
  constructor(
    private readonly loader = new ExcelWorkbookLoader(),
    private readonly importer = new ExcelImporter(),
    private readonly exporter = new ExcelExporter(),
  ) {}

  async importFile(
    file: File,
    repairMode = false,
  ): Promise<ImportedExcelSession> {
    const loaded = await this.loader.loadFile(file)
    return this.toSession(this.importer.import(loaded, { repairMode }))
  }

  async importBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    repairMode = false,
  ): Promise<ImportedExcelSession> {
    const loaded = await this.loader.loadArrayBuffer(buffer, fileName)
    return this.toSession(this.importer.import(loaded, { repairMode }))
  }

  async export(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExportedExcelWorkbook> {
    const result = await this.exporter.export(state, {
      ...(sourceBuffer ? { sourceBuffer } : {}),
    })
    return {
      buffer: result.buffer,
      blob: result.blob,
      fileName: result.fileName,
      issues: result.report.issues,
      preservationWarnings: result.preservationWarnings,
    }
  }

  async exportTemplate(): Promise<ExportedExcelWorkbook> {
    const result = await this.exporter.exportEmptyTemplate()
    return {
      buffer: result.buffer,
      blob: result.blob,
      fileName: result.fileName,
      issues: result.report.issues,
      preservationWarnings: result.preservationWarnings,
    }
  }

  exportBackup(
    sourceBuffer: ArrayBuffer,
    sourceFileName: string,
  ): ExportedExcelWorkbook {
    const result = this.exporter.exportBackup(sourceBuffer, sourceFileName)
    return {
      buffer: result.buffer,
      blob: result.blob,
      fileName: result.fileName,
      issues: result.report.issues,
      preservationWarnings: result.preservationWarnings,
    }
  }

  private toSession(
    result: ReturnType<ExcelImporter["import"]>,
  ): ImportedExcelSession {
    return {
      state: result.state,
      sourceBuffer: result.sourceBuffer,
      fileName: result.fileName,
      ...(result.inspection.schemaVersion
        ? { schemaVersion: result.inspection.schemaVersion }
        : {}),
      tables: result.inspection.tables,
      missingTables: result.inspection.missingTables,
      unknownTables: result.inspection.unknownTables,
      issues: result.report.issues,
      hasBlockingIssues: result.report.hasBlockingIssues,
    }
  }
}
