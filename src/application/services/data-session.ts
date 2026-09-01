import { DATA_SCHEMA_VERSION } from "../../config/data-format"
import { normalizeDomainState, type DomainCollections } from "./domain-state"
import type { DataFileSession, DataValidationIssue } from "./data-file-service"

export interface DataSessionSnapshot {
  version: 2
  savedAt: string
  fileName: string
  schemaVersion: string
  records: DomainCollections
  issues: readonly DataValidationIssue[]
  hasBlockingIssues: boolean
  dirty: boolean
  lastSavedAt?: string
}

export interface LegacyWorkbookSessionSnapshot {
  version: 1
  savedAt: string
  fileName: string
  schemaVersion?: string
  sourceBuffer?: ArrayBuffer
  records: DomainCollections
  issues?: readonly DataValidationIssue[]
  hasBlockingIssues?: boolean
  dirty: boolean
  lastExportAt?: string
  tables?: readonly unknown[]
  missingTables?: readonly string[]
  unknownTables?: readonly string[]
}

export type RecoverableSessionSnapshot =
  DataSessionSnapshot | LegacyWorkbookSessionSnapshot

export interface SessionSnapshotRepository {
  load(): Promise<RecoverableSessionSnapshot | undefined>
  save(snapshot: DataSessionSnapshot): Promise<void>
  clear(): Promise<void>
}

export function createDataSessionSnapshot(
  session: DataFileSession,
  dirty: boolean,
  lastSavedAt?: string,
): DataSessionSnapshot {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    fileName: session.fileName,
    schemaVersion: session.schemaVersion,
    records: structuredClone(session.state.records),
    issues: structuredClone(session.issues),
    hasBlockingIssues: session.hasBlockingIssues,
    dirty,
    ...(lastSavedAt ? { lastSavedAt } : {}),
  }
}

function recoveredJsonName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xlsm|xls)$/iu, "_hersteld.json")
}

export function restoreDataSession(
  snapshot: RecoverableSessionSnapshot,
): DataFileSession {
  const legacy = snapshot.version === 1
  const schemaUpgrade = snapshot.schemaVersion !== DATA_SCHEMA_VERSION
  const records = structuredClone(snapshot.records)
  if (schemaUpgrade) {
    records.resources = records.resources.map((resource) => ({
      ...resource,
      weeklyCapacityHours:
        typeof resource.weeklyCapacityHours === "number"
          ? resource.weeklyCapacityHours
          : resource.capacityFte * 40,
      availabilityExceptions: Array.isArray(resource.availabilityExceptions)
        ? resource.availabilityExceptions
        : [],
    }))
    if (records.config[0])
      records.config[0] = {
        ...records.config[0],
        schemaVersion: DATA_SCHEMA_VERSION,
      }
  }
  return {
    state: normalizeDomainState(records),
    fileName: legacy ? recoveredJsonName(snapshot.fileName) : snapshot.fileName,
    schemaVersion: schemaUpgrade
      ? DATA_SCHEMA_VERSION
      : (snapshot.schemaVersion ?? DATA_SCHEMA_VERSION),
    format: "json",
    origin: legacy ? "legacy-recovery" : "recovery",
    issues: legacy
      ? [
          {
            level: "Warning",
            code: "session.legacy-excel-recovered",
            message:
              "Een bestaande lokale Excel-sessie is hersteld. Sla ze voortaan op als JSON.",
          },
        ]
      : [
          ...structuredClone(snapshot.issues),
          ...(schemaUpgrade
            ? [
                {
                  level: "Info" as const,
                  code: "session.schema-upgraded",
                  message:
                    "De lokale sessie is bijgewerkt met weekcapaciteit en een capaciteitskalender.",
                },
              ]
            : []),
        ],
    hasBlockingIssues: legacy
      ? Boolean(snapshot.hasBlockingIssues)
      : snapshot.hasBlockingIssues,
  }
}

export function snapshotLastSavedAt(
  snapshot: RecoverableSessionSnapshot,
): string | undefined {
  return snapshot.version === 1 ? snapshot.lastExportAt : snapshot.lastSavedAt
}
