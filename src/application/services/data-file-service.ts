import type { NormalizedDomainState } from "./domain-state"

export type DataValidationLevel = "Blocking" | "Warning" | "Info"

export interface DataValidationIssue {
  level: DataValidationLevel
  code: string
  message: string
  collection?: string
  recordId?: string
  path?: string
}

export interface DataFileSession {
  state: NormalizedDomainState
  fileName: string
  schemaVersion: string
  format: "json"
  origin: "import" | "new" | "recovery" | "legacy-recovery"
  issues: readonly DataValidationIssue[]
  hasBlockingIssues: boolean
}

export interface ExportedDataFile {
  blob: Blob
  fileName: string
  text: string
  issues: readonly DataValidationIssue[]
}

export interface DataFileGateway {
  importFile(file: File): Promise<DataFileSession>
  importText(text: string, fileName: string): Promise<DataFileSession>
  createNewSession(): DataFileSession
  export(state: NormalizedDomainState): ExportedDataFile
}

export interface DataFileDownloadPort {
  download(blob: Blob, fileName: string): void
}

export class DataFileService {
  constructor(
    private readonly gateway: DataFileGateway,
    private readonly downloadPort: DataFileDownloadPort,
  ) {}

  importFile(file: File): Promise<DataFileSession> {
    return this.gateway.importFile(file)
  }

  importText(text: string, fileName: string): Promise<DataFileSession> {
    return this.gateway.importText(text, fileName)
  }

  createNewSession(): DataFileSession {
    return this.gateway.createNewSession()
  }

  exportAndDownload(state: NormalizedDomainState): ExportedDataFile {
    const exported = this.gateway.export(state)
    this.downloadPort.download(exported.blob, exported.fileName)
    return exported
  }
}
