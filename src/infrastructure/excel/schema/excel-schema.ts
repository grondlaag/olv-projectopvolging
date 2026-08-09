import {
  actionStatuses,
  agendaDiscussionStatuses,
  agendaObjectTypes,
  actorTypes,
  budgetStatuses,
  budgetTypes,
  meetingScopeTypes,
  meetingStatuses,
  objectTypes,
  planningKinds,
  planningStatuses,
  priorities,
  projectStatuses,
  recordStatuses,
  reportStatuses,
  topicStatuses,
  updateTypes,
} from "../../../domain"
import type { DomainCollectionKey } from "../../../application/services"

export const EXCEL_SCHEMA_VERSION = "1.0.0"

export type ExcelColumnKind =
  | "string"
  | "uuid"
  | "localDate"
  | "dateTime"
  | "integer"
  | "number"
  | "boolean"
  | "money"

export interface ExcelColumnDefinition {
  header: string
  path: string
  kind: ExcelColumnKind
  optional?: boolean
  allowedValues?: readonly string[]
  allowNegative?: boolean
  defaultValue?: string
}

export interface ExcelTableDefinition {
  collection: DomainCollectionKey
  tableName: string
  worksheetName: string
  required: boolean
  columns: readonly ExcelColumnDefinition[]
}

export interface ExcelSchema {
  version: string
  tables: readonly ExcelTableDefinition[]
}

const column = (
  header: string,
  path: string,
  kind: ExcelColumnKind = "string",
  options: Omit<ExcelColumnDefinition, "header" | "path" | "kind"> = {},
): ExcelColumnDefinition => ({ header, path, kind, ...options })

const optional = { optional: true } as const

const auditColumns = (): ExcelColumnDefinition[] => [
  column("datum-aangemaakt", "audit.createdAt", "dateTime"),
  column("aangemaakt-door-guid", "audit.createdByActorId", "uuid", optional),
  column("datum-gewijzigd", "audit.updatedAt", "dateTime"),
  column("gewijzigd-door-guid", "audit.updatedByActorId", "uuid", optional),
  column("actief", "audit.active", "boolean"),
]

const audited = (
  columns: readonly ExcelColumnDefinition[],
): readonly ExcelColumnDefinition[] => [
  column("guid", "id", "uuid"),
  ...columns,
  ...auditColumns(),
]

export const excelSchema: ExcelSchema = {
  version: EXCEL_SCHEMA_VERSION,
  tables: [
    {
      collection: "chapters",
      tableName: "tblHoofdstukken",
      worksheetName: "Hoofdstukken",
      required: true,
      columns: audited([
        column("code", "code"),
        column("titel", "title"),
        column("volgorde", "order", "integer"),
        column("status", "status", "string", {
          allowedValues: recordStatuses,
        }),
      ]),
    },
    {
      collection: "clusters",
      tableName: "tblClusters",
      worksheetName: "Clusters",
      required: true,
      columns: audited([
        column("hoofdstuk-guid", "chapterId", "uuid"),
        column("code", "code"),
        column("titel", "title"),
        column("beschrijving", "description", "string", {
          optional: true,
          defaultValue: "",
        }),
        column("status", "status", "string", {
          allowedValues: recordStatuses,
        }),
        column("actuele-update-guid", "currentUpdateId", "uuid", optional),
        column("volgorde", "order", "integer"),
      ]),
    },
    {
      collection: "projects",
      tableName: "tblProjecten",
      worksheetName: "Projecten",
      required: true,
      columns: audited([
        column("hoofdstuk-guid", "chapterId", "uuid"),
        column("cluster-guid", "clusterId", "uuid", optional),
        column("code", "code"),
        column("titel", "title"),
        column("beschrijving", "description", "string", {
          optional: true,
          defaultValue: "",
        }),
        column("status", "status", "string", {
          allowedValues: projectStatuses,
        }),
        column("fase", "phase", "string", {
          optional: true,
          defaultValue: "",
        }),
        column("site", "site", "string", optional),
        column("locatie", "location", "string", optional),
        column("afdeling", "department", "string", optional),
        column(
          "coordinator-actor-guid",
          "coordinatorActorId",
          "uuid",
          optional,
        ),
        column("startdatum", "startDate", "localDate", optional),
        column("geplande-einddatum", "plannedEndDate", "localDate", optional),
        column("werkelijke-einddatum", "actualEndDate", "localDate", optional),
        column("voortgang-procent", "progressPercent", "number", optional),
        column("actuele-update-guid", "currentUpdateId", "uuid", optional),
        column("documenten-url", "documentsUrl", "string", optional),
      ]),
    },
    {
      collection: "projectClusterHistory",
      tableName: "tblProjectClusterHistoriek",
      worksheetName: "ProjectClusterHistoriek",
      required: true,
      columns: audited([
        column("project-guid", "projectId", "uuid"),
        column("cluster-guid", "clusterId", "uuid"),
        column("geldig-vanaf", "validFrom", "localDate"),
        column("geldig-tot", "validTo", "localDate", optional),
        column("reden", "reason", "string", optional),
        column("auteur-actor-guid", "authorActorId", "uuid", optional),
      ]),
    },
    {
      collection: "actors",
      tableName: "tblActoren",
      worksheetName: "Actoren",
      required: true,
      columns: audited([
        column("type", "type", "string", { allowedValues: actorTypes }),
        column("weergavenaam", "displayName"),
        column("email", "email", "string", optional),
        column("organisatie", "organization", "string", optional),
        column("rol", "role", "string", optional),
        column("actor-actief", "active", "boolean"),
      ]),
    },
    {
      collection: "topics",
      tableName: "tblTopics",
      worksheetName: "Topics",
      required: true,
      columns: audited([
        column("ouder-type", "parentType", "string", {
          allowedValues: ["Project", "Cluster"],
        }),
        column("project-guid", "projectId", "uuid", optional),
        column("cluster-guid", "clusterId", "uuid", optional),
        column("code", "code"),
        column("titel", "title"),
        column("context", "context"),
        column("eigenaar-actor-guid", "ownerActorId", "uuid", optional),
        column("prioriteit", "priority", "string", {
          allowedValues: priorities,
        }),
        column("status", "status", "string", {
          allowedValues: topicStatuses,
        }),
        column("volgorde", "order", "integer"),
        column("actuele-update-guid", "currentUpdateId", "uuid", optional),
      ]),
    },
    {
      collection: "updates",
      tableName: "tblUpdates",
      worksheetName: "Updates",
      required: true,
      columns: audited([
        column("object-type", "objectType", "string", {
          allowedValues: objectTypes,
        }),
        column("object-guid", "objectId", "uuid"),
        column("overleg-guid", "meetingId", "uuid", optional),
        column("type", "type", "string", { allowedValues: updateTypes }),
        column("datum", "date", "localDate"),
        column("auteur-actor-guid", "authorActorId", "uuid"),
        column("tekst", "text"),
      ]),
    },
    {
      collection: "actions",
      tableName: "tblActies",
      worksheetName: "Acties",
      required: true,
      columns: audited([
        column("object-type", "objectType", "string", {
          allowedValues: objectTypes,
        }),
        column("object-guid", "objectId", "uuid"),
        column("bron-overleg-guid", "sourceMeetingId", "uuid", optional),
        column("code", "code"),
        column("titel", "title"),
        column("beschrijving", "description", "string", optional),
        column("eigenaar-actor-guid", "ownerActorId", "uuid"),
        column("deadline", "deadline", "localDate", optional),
        column("status", "status", "string", {
          allowedValues: actionStatuses,
        }),
        column("prioriteit", "priority", "string", {
          allowedValues: priorities,
        }),
        column("afgerond-op", "completedAt", "localDate", optional),
      ]),
    },
    {
      collection: "actionHistory",
      tableName: "tblActieHistoriek",
      worksheetName: "ActieHistoriek",
      required: true,
      columns: audited([
        column("actie-guid", "actionId", "uuid"),
        column("gewijzigd-op", "changedAt", "dateTime"),
        column("gewijzigd-door-actor-guid", "changedByActorId", "uuid"),
        column("veld", "field"),
        column("vorige-waarde", "previousValue", "string", optional),
        column("nieuwe-waarde", "newValue", "string", optional),
        column("reden", "reason", "string", optional),
      ]),
    },
    {
      collection: "evidence",
      tableName: "tblBewijs",
      worksheetName: "Bewijs",
      required: true,
      columns: audited([
        column("object-type", "objectType", "string", {
          allowedValues: objectTypes,
        }),
        column("object-guid", "objectId", "uuid"),
        column("type", "type"),
        column("titel", "title"),
        column("beschrijving", "description", "string", optional),
        column("url-of-referentie", "urlOrReference", "string", optional),
        column("datum", "date", "localDate", optional),
        column("auteur-actor-guid", "authorActorId", "uuid", optional),
      ]),
    },
    {
      collection: "planning",
      tableName: "tblPlanning",
      worksheetName: "Planning",
      required: true,
      columns: audited([
        column("project-guid", "projectId", "uuid"),
        column("topic-guid", "topicId", "uuid", optional),
        column("soort", "kind", "string", { allowedValues: planningKinds }),
        column("titel", "title"),
        column("startdatum", "startDate", "localDate", optional),
        column("geplande-einddatum", "plannedEndDate", "localDate"),
        column("werkelijke-einddatum", "actualEndDate", "localDate", optional),
        column("voortgang-procent", "progressPercent", "number", optional),
        column("status", "status", "string", {
          allowedValues: planningStatuses,
        }),
        column("is-mijlpaal", "isMilestone", "boolean"),
        column("volgorde", "order", "integer"),
      ]),
    },
    {
      collection: "planningDependencies",
      tableName: "tblPlanningAfhankelijkheden",
      worksheetName: "PlanningAfhankelijkheden",
      required: true,
      columns: audited([
        column("voorganger-planning-guid", "predecessorPlanningId", "uuid"),
        column("opvolger-planning-guid", "successorPlanningId", "uuid"),
        column("type", "type", "string", {
          allowedValues: ["FinishToStart"],
        }),
      ]),
    },
    {
      collection: "budgets",
      tableName: "tblBudget",
      worksheetName: "Budget",
      required: true,
      columns: audited([
        column("project-guid", "projectId", "uuid"),
        column("topic-guid", "topicId", "uuid", optional),
        column("categorie", "category"),
        column("type", "type", "string", { allowedValues: budgetTypes }),
        column("beschrijving", "description"),
        column("bedrag", "amountCents", "money"),
        column("datum", "date", "localDate"),
        column("status", "status", "string", {
          allowedValues: budgetStatuses,
        }),
        column("referentie", "reference", "string", optional),
        column("leverancier-actor-guid", "supplierActorId", "uuid", optional),
      ]),
    },
    {
      collection: "budgetMutations",
      tableName: "tblBudgetMutaties",
      worksheetName: "BudgetMutaties",
      required: true,
      columns: audited([
        column("budgetrecord-guid", "budgetRecordId", "uuid"),
        column("wijzigingstype", "changeType"),
        column("delta-bedrag", "deltaCents", "money", {
          ...optional,
          allowNegative: true,
        }),
        column("vorig-bedrag", "previousAmountCents", "money", optional),
        column("nieuw-bedrag", "newAmountCents", "money", optional),
        column("reden", "reason"),
        column("datum", "date", "localDate"),
        column("auteur-actor-guid", "authorActorId", "uuid"),
      ]),
    },
    {
      collection: "meetings",
      tableName: "tblOverleggen",
      worksheetName: "Overleggen",
      required: true,
      columns: audited([
        column("type", "type"),
        column("scope-type", "scopeType", "string", {
          allowedValues: meetingScopeTypes,
        }),
        column("scope-guid", "scopeId", "uuid", optional),
        column("nummer", "number", "string", optional),
        column("titel", "title"),
        column("datum", "date", "localDate"),
        column("voorzitter-actor-guid", "chairActorId", "uuid", optional),
        column("verslaggever-actor-guid", "reporterActorId", "uuid", optional),
        column("status", "status", "string", {
          allowedValues: meetingStatuses,
        }),
        column("volgend-overleg", "nextMeetingDate", "localDate", optional),
      ]),
    },
    {
      collection: "meetingParticipants",
      tableName: "tblOverlegDeelnemers",
      worksheetName: "OverlegDeelnemers",
      required: true,
      columns: audited([
        column("overleg-guid", "meetingId", "uuid"),
        column("actor-guid", "actorId", "uuid"),
        column("rol", "role", "string", optional),
        column("aanwezig", "attended", "boolean"),
      ]),
    },
    {
      collection: "agendaItems",
      tableName: "tblAgendaItems",
      worksheetName: "AgendaItems",
      required: true,
      columns: audited([
        column("overleg-guid", "meetingId", "uuid"),
        column("volgorde", "order", "integer"),
        column("titel", "title"),
        column("beschrijving", "reason", "string", optional),
        column("notities", "notes", "string", optional),
        column("object-type", "objectType", "string", {
          ...optional,
          allowedValues: agendaObjectTypes,
        }),
        column("object-guid", "objectId", "uuid", optional),
        column("status", "discussionStatus", "string", {
          ...optional,
          allowedValues: agendaDiscussionStatuses,
          defaultValue: "Te bespreken",
        }),
      ]),
    },
    {
      collection: "reports",
      tableName: "tblVerslagen",
      worksheetName: "Verslagen",
      required: true,
      columns: audited([
        column("overleg-guid", "meetingId", "uuid"),
        column("versie", "version", "integer"),
        column("status", "status", "string", {
          allowedValues: reportStatuses,
        }),
        column("conceptdatum", "draftDate", "localDate", optional),
        column("finaledatum", "finalDate", "localDate", optional),
        column("auteur-actor-guid", "authorActorId", "uuid"),
        column("pdf-referentie", "pdfReference", "string", optional),
      ]),
    },
    {
      collection: "reportItems",
      tableName: "tblVerslagItems",
      worksheetName: "VerslagItems",
      required: true,
      columns: audited([
        column("verslag-guid", "reportId", "uuid"),
        column("volgorde", "order", "integer"),
        column("sectie", "section"),
        column("inhoudstype", "contentType"),
        column("object-type", "objectType", "string", {
          ...optional,
          allowedValues: objectTypes,
        }),
        column("object-guid", "objectId", "uuid", optional),
        column("titel-snapshot", "titleSnapshot"),
        column("tekst-snapshot", "textSnapshot"),
      ]),
    },
    {
      collection: "config",
      tableName: "tblConfig",
      worksheetName: "Config",
      required: true,
      columns: audited([
        column("schema-versie", "schemaVersion"),
        column("workbook-guid", "workbookId", "uuid"),
        column("config-aangemaakt-op", "createdAt", "dateTime"),
        column("app-versie", "appVersion"),
        column("standaardvaluta", "defaultCurrency"),
        column("huidige-actor-guid", "currentActorId", "uuid", optional),
      ]),
    },
    {
      collection: "choiceLists",
      tableName: "tblKeuzelijsten",
      worksheetName: "Keuzelijsten",
      required: true,
      columns: audited([
        column("lijst-key", "listKey"),
        column("waarde-key", "valueKey"),
        column("label", "label"),
        column("volgorde", "order", "integer"),
        column("systeemlijst", "system", "boolean"),
        column("keuze-actief", "active", "boolean"),
      ]),
    },
    {
      collection: "log",
      tableName: "tblLogboek",
      worksheetName: "Logboek",
      required: true,
      columns: audited([
        column("niveau", "level", "string", {
          allowedValues: ["Blocking", "Recoverable", "Warning", "Info"],
        }),
        column("bericht", "message"),
        column("object-type", "objectType", "string", {
          ...optional,
          allowedValues: objectTypes,
        }),
        column("object-guid", "objectId", "uuid", optional),
        column("gebeurd-op", "occurredAt", "dateTime"),
      ]),
    },
  ],
}

export const excelTableByName = new Map(
  excelSchema.tables.map((definition) => [definition.tableName, definition]),
)

export const excelTableByCollection = new Map(
  excelSchema.tables.map((definition) => [definition.collection, definition]),
)
