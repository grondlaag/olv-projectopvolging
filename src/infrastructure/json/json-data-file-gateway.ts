import {
  createEmptyDomainCollections,
  normalizeDomainState,
  validateDomainIntegrity,
  type DataFileGateway,
  type DataFileSession,
  type DataValidationIssue,
  type ExportedDataFile,
  type NormalizedDomainState,
} from "../../application/services"
import { APP_VERSION } from "../../config/app-metadata"
import type {
  AuditFields,
  Chapter,
  ChoiceList,
  Config,
  DateTime,
  UUID,
} from "../../domain"
import {
  JSON_DATA_FORMAT,
  JSON_DATA_SCHEMA_VERSION,
  jsonDataEnvelopeSchema,
  type JsonDataEnvelope,
} from "./schema"

function uuid(): UUID {
  return crypto.randomUUID() as UUID
}

function nowIso(now = new Date()): DateTime {
  return now.toISOString() as DateTime
}

function audit(timestamp: DateTime): AuditFields {
  return {
    createdAt: timestamp,
    updatedAt: timestamp,
    active: true,
  }
}

function emptyInvalidSession(
  fileName: string,
  issue: DataValidationIssue,
): DataFileSession {
  return {
    state: normalizeDomainState(createEmptyDomainCollections()),
    fileName,
    schemaVersion: "onbekend",
    format: "json",
    origin: "import",
    issues: [issue],
    hasBlockingIssues: true,
  }
}

function pathToString(path: readonly PropertyKey[]): string {
  return path.map(String).join(".")
}

function migrateLegacyEnvelope(source: unknown): unknown {
  if (!source || typeof source !== "object") return source
  const envelope = structuredClone(source) as Record<string, unknown>
  if (envelope.schemaVersion !== "1.0.0") return envelope
  const records = envelope.records
  if (!records || typeof records !== "object") return envelope
  const collections = records as Record<string, unknown>
  const planning = Array.isArray(collections.planning)
    ? (collections.planning as Record<string, unknown>[])
    : []
  const dependencies = Array.isArray(collections.planningDependencies)
    ? (collections.planningDependencies as Record<string, unknown>[])
    : []
  const projectPhases: Record<string, unknown>[] = []
  const milestones: Record<string, unknown>[] = []
  const convertedIds = new Set<string>()

  for (const entry of planning) {
    const id = String(entry.id ?? "")
    if (entry.kind === "Custom") {
      projectPhases.push({
        id: entry.id,
        projectId: entry.projectId,
        name: entry.title,
        startDate: entry.startDate ?? entry.plannedEndDate,
        endDate: entry.plannedEndDate,
        status: entry.status,
        progressPercent: entry.progressPercent ?? 0,
        intensity: "Normaal",
        order: entry.order ?? projectPhases.length + 1,
        audit: entry.audit,
      })
      convertedIds.add(id)
    }
    if (entry.kind === "Milestone" || entry.isMilestone === true) {
      milestones.push({
        id: entry.id,
        projectId: entry.projectId,
        name: entry.title,
        date: entry.plannedEndDate,
        status: entry.status === "Afgerond" ? "Behaald" : "Gepland",
        audit: entry.audit,
      })
      convertedIds.add(id)
    }
  }

  for (const dependency of dependencies) {
    const successor = projectPhases.find(
      (phase) => phase.id === dependency.successorPlanningId,
    )
    if (
      successor &&
      projectPhases.some(
        (phase) => phase.id === dependency.predecessorPlanningId,
      )
    ) {
      successor.dependsOnPhaseId = dependency.predecessorPlanningId
    }
  }

  collections.planning = planning.filter(
    (entry) => !convertedIds.has(String(entry.id ?? "")),
  )
  collections.planningDependencies = dependencies.filter(
    (dependency) =>
      !convertedIds.has(String(dependency.predecessorPlanningId ?? "")) &&
      !convertedIds.has(String(dependency.successorPlanningId ?? "")),
  )
  collections.projectPhases = projectPhases
  collections.milestones = milestones
  collections.resources = []
  collections.resourceAssignments = []
  if (Array.isArray(collections.config) && collections.config[0]) {
    ;(collections.config[0] as Record<string, unknown>).schemaVersion =
      JSON_DATA_SCHEMA_VERSION
  }
  envelope.schemaVersion = JSON_DATA_SCHEMA_VERSION
  return envelope
}

function importedSession(
  envelope: JsonDataEnvelope,
  fileName: string,
): DataFileSession {
  const issues: DataValidationIssue[] = validateDomainIntegrity(
    envelope.records,
  ).map((issue) => ({
    level: "Blocking",
    code: issue.code,
    message: issue.message,
    collection: issue.collection,
    ...(issue.recordId ? { recordId: issue.recordId } : {}),
  }))
  const config = envelope.records.config[0]
  if (config && config.dataSetId !== envelope.dataSetId) {
    issues.push({
      level: "Blocking",
      code: "json.dataset-id.mismatch",
      message:
        "De gegevensset-ID in de bestandskop komt niet overeen met de configuratie.",
      collection: "config",
      recordId: config.id,
    })
  }
  if (config && config.schemaVersion !== envelope.schemaVersion) {
    issues.push({
      level: "Blocking",
      code: "json.schema-version.mismatch",
      message:
        "De schema-versie in de bestandskop komt niet overeen met de configuratie.",
      collection: "config",
      recordId: config.id,
    })
  }

  return {
    state: normalizeDomainState(structuredClone(envelope.records)),
    fileName,
    schemaVersion: envelope.schemaVersion,
    format: "json",
    origin: "import",
    issues,
    hasBlockingIssues: issues.some((issue) => issue.level === "Blocking"),
  }
}

const initialChapterTitles = [
  ["H1", "Gebouw en ruimte"],
  ["H2", "Technieken en infrastructuur"],
  ["H3", "Beleid en opvolging"],
] as const

const initialChoices = [
  ["project-phase", "initiatie", "Initiatie"],
  ["project-phase", "ontwerp", "Ontwerp"],
  ["project-phase", "aanbesteding", "Aanbesteding"],
  ["project-phase", "uitvoering", "Uitvoering"],
  ["project-phase", "nazorg", "Nazorg"],
  ["budget-category", "bouw", "Bouw"],
  ["budget-category", "technieken", "Technieken"],
  ["budget-category", "inrichting", "Inrichting"],
  ["budget-category", "honoraria", "Honoraria"],
  ["budget-category", "overig", "Overig"],
  ["meeting-type", "projectoverleg", "Projectoverleg"],
  ["meeting-type", "werfvergadering", "Werfvergadering"],
  ["meeting-type", "stuurgroep", "Stuurgroep"],
] as const

function createInitialRecords() {
  const records = createEmptyDomainCollections()
  const timestamp = nowIso()
  const dataSetId = uuid()
  records.chapters.push(
    ...initialChapterTitles.map(([code, title], index): Chapter => ({
      id: uuid(),
      code,
      title,
      order: index + 1,
      status: "Active",
      audit: audit(timestamp),
    })),
  )
  records.choiceLists.push(
    ...initialChoices.map(([listKey, valueKey, label], index): ChoiceList => ({
      id: uuid(),
      listKey,
      valueKey,
      label,
      order: index + 1,
      system: false,
      active: true,
      audit: audit(timestamp),
    })),
  )
  const config: Config = {
    id: uuid(),
    schemaVersion: JSON_DATA_SCHEMA_VERSION,
    dataSetId,
    createdAt: timestamp,
    appVersion: APP_VERSION,
    defaultCurrency: "EUR",
    audit: audit(timestamp),
  }
  records.config.push(config)
  return records
}

function exportFileName(now = new Date()): string {
  const date = now.toISOString().slice(0, 10)
  const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`
  return `OLV_Projectopvolging_${date}_${time}.json`
}

export class JsonDataFileGateway implements DataFileGateway {
  async importFile(file: File): Promise<DataFileSession> {
    if (!file.name.toLocaleLowerCase("nl").endsWith(".json")) {
      throw new Error("Selecteer een .json-bestand.")
    }
    return this.importText(await file.text(), file.name)
  }

  async importText(text: string, fileName: string): Promise<DataFileSession> {
    let source: unknown
    try {
      source = JSON.parse(text) as unknown
    } catch {
      return emptyInvalidSession(fileName, {
        level: "Blocking",
        code: "json.syntax.invalid",
        message:
          "Het bestand bevat geen geldige JSON. Controleer of het bestand volledig en ongewijzigd is.",
      })
    }

    const parsed = jsonDataEnvelopeSchema.safeParse(migrateLegacyEnvelope(source))
    if (!parsed.success) {
      const issues: DataValidationIssue[] = parsed.error.issues.map(
        (issue) => ({
          level: "Blocking",
          code: "json.structure.invalid",
          message: `${pathToString(issue.path) || "bestand"}: ${issue.message}`,
          path: pathToString(issue.path),
        }),
      )
      const session = emptyInvalidSession(
        fileName,
        issues[0] ?? {
          level: "Blocking",
          code: "json.structure.invalid",
          message: "De JSON-structuur is ongeldig.",
        },
      )
      return { ...session, issues }
    }

    return importedSession(parsed.data as JsonDataEnvelope, fileName)
  }

  createNewSession(): DataFileSession {
    return {
      state: normalizeDomainState(createInitialRecords()),
      fileName: "OLV_Projectopvolging_nieuw.json",
      schemaVersion: JSON_DATA_SCHEMA_VERSION,
      format: "json",
      origin: "new",
      issues: [
        {
          level: "Info",
          code: "json.dataset.new",
          message:
            "Nieuwe lokale gegevensset met de drie standaardhoofdstukken.",
        },
      ],
      hasBlockingIssues: false,
    }
  }

  export(state: NormalizedDomainState): ExportedDataFile {
    const integrityIssues = validateDomainIntegrity(state.records)
    if (integrityIssues.length) {
      throw new Error(
        `Opslaan is geblokkeerd: ${integrityIssues[0]?.message ?? "de gegevens bevatten een ongeldige relatie."}`,
      )
    }
    const config = state.records.config[0]
    if (!config) {
      throw new Error("Opslaan is geblokkeerd: configuratie ontbreekt.")
    }
    const envelope: JsonDataEnvelope = {
      format: JSON_DATA_FORMAT,
      schemaVersion: JSON_DATA_SCHEMA_VERSION,
      exportedAt: nowIso(),
      appVersion: APP_VERSION,
      dataSetId: config.dataSetId,
      records: structuredClone(state.records),
    }
    const checked = jsonDataEnvelopeSchema.parse(envelope)
    const text = `${JSON.stringify(checked, null, 2)}\n`
    return {
      blob: new Blob([text], { type: "application/json;charset=utf-8" }),
      fileName: exportFileName(),
      text,
      issues: [],
    }
  }
}
