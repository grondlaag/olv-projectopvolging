import { normalizeDomainState, type DomainCollections } from "./domain-state"
import type {
  ExcelTableSummary,
  ExcelValidationIssueDto,
  ImportedExcelSession,
} from "./excel-workbook-service"

export interface WorkbookSessionSnapshot {
  version: 1
  savedAt: string
  fileName: string
  schemaVersion?: string
  sourceBuffer: ArrayBuffer
  records: DomainCollections
  tables: readonly ExcelTableSummary[]
  missingTables: readonly string[]
  unknownTables: readonly string[]
  issues: readonly ExcelValidationIssueDto[]
  hasBlockingIssues: boolean
  dirty: boolean
  lastExportAt?: string
}

export interface SessionSnapshotRepository {
  load(): Promise<WorkbookSessionSnapshot | undefined>
  save(snapshot: WorkbookSessionSnapshot): Promise<void>
  clear(): Promise<void>
}

export function createWorkbookSessionSnapshot(
  session: ImportedExcelSession,
  dirty: boolean,
  lastExportAt?: string,
): WorkbookSessionSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    fileName: session.fileName,
    ...(session.schemaVersion ? { schemaVersion: session.schemaVersion } : {}),
    sourceBuffer: session.sourceBuffer.slice(0),
    records: structuredClone(session.state.records),
    tables: structuredClone(session.tables),
    missingTables: [...session.missingTables],
    unknownTables: [...session.unknownTables],
    issues: structuredClone(session.issues),
    hasBlockingIssues: session.hasBlockingIssues,
    dirty,
    ...(lastExportAt ? { lastExportAt } : {}),
  }
}

export function restoreWorkbookSession(
  snapshot: WorkbookSessionSnapshot,
): ImportedExcelSession {
  return {
    state: normalizeDomainState(structuredClone(snapshot.records)),
    sourceBuffer: snapshot.sourceBuffer.slice(0),
    fileName: snapshot.fileName,
    ...(snapshot.schemaVersion
      ? { schemaVersion: snapshot.schemaVersion }
      : {}),
    tables: structuredClone(snapshot.tables),
    missingTables: [...snapshot.missingTables],
    unknownTables: [...snapshot.unknownTables],
    issues: structuredClone(snapshot.issues),
    hasBlockingIssues: snapshot.hasBlockingIssues,
  }
}
