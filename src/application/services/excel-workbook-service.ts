import type { UUID } from "../../domain"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import {
  cloneDomainCollections,
  compareDomainStates,
  type SemanticComparison,
} from "./semantic-comparison"

export type ExcelValidationLevel =
  "Blocking" | "Recoverable" | "Warning" | "Info"

export interface ExcelValidationIssueDto {
  level: ExcelValidationLevel
  code: string
  message: string
  tableName?: string
  rowNumber?: number
  columnName?: string
  repaired?: boolean
}

export interface ExcelTableSummary {
  name: string
  worksheetName: string
  rowCount: number
  columns: readonly string[]
  known: boolean
}

export interface ImportedExcelSession {
  state: NormalizedDomainState
  sourceBuffer: ArrayBuffer
  fileName: string
  schemaVersion?: string
  tables: readonly ExcelTableSummary[]
  missingTables: readonly string[]
  unknownTables: readonly string[]
  issues: readonly ExcelValidationIssueDto[]
  hasBlockingIssues: boolean
}

export interface ExportedExcelWorkbook {
  buffer: ArrayBuffer
  blob: Blob
  fileName: string
  issues: readonly ExcelValidationIssueDto[]
  preservationWarnings: readonly string[]
}

export interface ExcelWorkbookGateway {
  importFile(file: File, repairMode?: boolean): Promise<ImportedExcelSession>
  importBuffer(
    buffer: ArrayBuffer,
    fileName: string,
    repairMode?: boolean,
  ): Promise<ImportedExcelSession>
  export(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExportedExcelWorkbook>
  exportTemplate(): Promise<ExportedExcelWorkbook>
  exportBackup(
    sourceBuffer: ArrayBuffer,
    sourceFileName: string,
  ): ExportedExcelWorkbook
}

export interface FileDownloadPort {
  download(blob: Blob, fileName: string): void
}

export interface ExcelRoundTripResult {
  exported: ExportedExcelWorkbook
  reimported: ImportedExcelSession
  comparison: SemanticComparison
}

export class ExcelWorkbookService {
  constructor(
    private readonly gateway: ExcelWorkbookGateway,
    private readonly downloadPort: FileDownloadPort,
  ) {}

  importFile(file: File, repairMode = false): Promise<ImportedExcelSession> {
    return this.gateway.importFile(file, repairMode)
  }

  updateProjectTitle(
    state: NormalizedDomainState,
    projectId: UUID,
    title: string,
  ): NormalizedDomainState {
    const records = cloneDomainCollections(state.records)
    const project = records.projects.find(
      (candidate) => candidate.id === projectId,
    )
    if (!project) throw new Error("Project niet gevonden.")
    const normalizedTitle = title.trim()
    if (!normalizedTitle)
      throw new Error("Een projecttitel mag niet leeg zijn.")
    project.title = normalizedTitle
    return normalizeDomainState(records)
  }

  async exportAndDownload(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExportedExcelWorkbook> {
    const exported = await this.gateway.export(state, sourceBuffer)
    this.downloadPort.download(exported.blob, exported.fileName)
    return exported
  }

  async downloadTemplate(): Promise<ExportedExcelWorkbook> {
    const exported = await this.gateway.exportTemplate()
    this.downloadPort.download(exported.blob, exported.fileName)
    return exported
  }

  downloadBackup(
    sourceBuffer: ArrayBuffer,
    sourceFileName: string,
  ): ExportedExcelWorkbook {
    const exported = this.gateway.exportBackup(sourceBuffer, sourceFileName)
    this.downloadPort.download(exported.blob, exported.fileName)
    return exported
  }

  async verifyRoundTrip(
    state: NormalizedDomainState,
    sourceBuffer?: ArrayBuffer,
  ): Promise<ExcelRoundTripResult> {
    const exported = await this.gateway.export(state, sourceBuffer)
    const reimported = await this.gateway.importBuffer(
      exported.buffer,
      exported.fileName,
    )
    return {
      exported,
      reimported,
      comparison: compareDomainStates(state, reimported.state),
    }
  }
}
