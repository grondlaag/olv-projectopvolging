export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type UUID = Brand<string, "UUID">
export type LocalDate = Brand<string, "LocalDate">
export type DateTime = Brand<string, "DateTime">
export type MoneyCents = Brand<number, "MoneyCents">

export const objectTypes = [
  "Chapter",
  "Cluster",
  "Project",
  "Topic",
  "Update",
  "Action",
  "Evidence",
  "PlanningEntry",
  "ProjectPhase",
  "Milestone",
  "Resource",
  "ResourceAssignment",
  "BudgetRecord",
  "Meeting",
  "Report",
] as const

export type ObjectType = (typeof objectTypes)[number]

export interface AuditFields {
  createdAt: DateTime
  createdByActorId?: UUID
  updatedAt: DateTime
  updatedByActorId?: UUID
  active: boolean
}

export const priorities = ["Laag", "Normaal", "Hoog", "Kritiek"] as const
export type Priority = (typeof priorities)[number]

export const recordStatuses = ["Active", "Inactive"] as const
export type RecordStatus = (typeof recordStatuses)[number]

export const projectStatuses = [
  "Idee",
  "Voorbereiding",
  "Studie",
  "Aanbesteding",
  "Uitvoering",
  "Oplevering",
  "On hold",
  "Afgesloten",
  "Geannuleerd",
] as const
export type ProjectStatus = (typeof projectStatuses)[number]

export const projectSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const
export type ProjectSize = (typeof projectSizes)[number]

export const projectSizeFte: Readonly<Record<ProjectSize, number>> = {
  XS: 0.1,
  S: 0.25,
  M: 0.5,
  L: 1,
  XL: 1.5,
  XXL: 2,
}

export const projectPlanningStatuses = [
  "Niet gepland",
  "Op schema",
  "Aandacht",
  "Vertraagd",
  "Afgerond",
] as const
export type ProjectPlanningStatus = (typeof projectPlanningStatuses)[number]

export const phaseIntensities = ["Laag", "Normaal", "Hoog", "Piek"] as const
export type PhaseIntensity = (typeof phaseIntensities)[number]
export const phaseIntensityFactors: Readonly<Record<PhaseIntensity, number>> = {
  Laag: 0.5,
  Normaal: 1,
  Hoog: 1.5,
  Piek: 2,
}

export const milestoneStatuses = [
  "Gepland",
  "Behaald",
  "Gemist",
  "Geannuleerd",
] as const
export type MilestoneStatus = (typeof milestoneStatuses)[number]

export const resourceTypes = [
  "human",
  "role",
  "team",
  "external_party",
  "space",
  "equipment",
] as const
export type ResourceType = (typeof resourceTypes)[number]

export const allocationModes = ["fte", "hours", "total", "indicative"] as const
export type AllocationMode = (typeof allocationModes)[number]

export const topicStatuses = ["Open", "Afgesloten", "Geannuleerd"] as const
export type TopicStatus = (typeof topicStatuses)[number]

export const actionStatuses = [
  "Open",
  "Bezig",
  "Wacht op derde",
  "Wacht op beslissing",
  "Afgerond",
  "Geannuleerd",
] as const
export type ActionStatus = (typeof actionStatuses)[number]

export const actorTypes = [
  "Intern",
  "Architect",
  "Aannemer",
  "Studiebureau",
  "Leverancier",
  "Overheid",
  "Andere",
] as const
export type ActorType = (typeof actorTypes)[number]

export const updateTypes = [
  "Update",
  "Beslissing",
  "Projectstatus",
  "Clusterstatus",
  "Notitie",
  "Overlegbijdrage",
  "Planningwijziging",
  "Budgetwijziging",
] as const
export type UpdateType = (typeof updateTypes)[number]

export const planningKinds = ["Topic", "Milestone", "Custom"] as const
export type PlanningKind = (typeof planningKinds)[number]

export const planningStatuses = [
  "Niet gestart",
  "Op schema",
  "Risico",
  "Vertraagd",
  "Afgerond",
  "Geannuleerd",
] as const
export type PlanningStatus = (typeof planningStatuses)[number]

export type PlanningDependencyType = "FinishToStart"

export const budgetTypes = [
  "Goedgekeurd budget",
  "Raming",
  "Contract",
  "Bestelling",
  "Factuur",
  "Betaling",
  "Meerwerk",
  "Minwerk",
  "Contingentie",
  "Correctie",
] as const
export type BudgetType = (typeof budgetTypes)[number]

export const budgetStatuses = [
  "Concept",
  "Verwacht",
  "Goedgekeurd",
  "Vastgelegd",
  "Gefactureerd",
  "Betaald",
  "Geannuleerd",
] as const
export type BudgetStatus = (typeof budgetStatuses)[number]

export const meetingScopeTypes = [
  "Portfolio",
  "Hoofdstuk",
  "Cluster",
  "Project",
] as const
export type MeetingScopeType = (typeof meetingScopeTypes)[number]

export const meetingStatuses = ["Concept", "Definitief"] as const
export type MeetingStatus = (typeof meetingStatuses)[number]

export const agendaObjectTypes = [
  "Project",
  "Cluster",
  "Topic",
  "Action",
] as const
export type AgendaObjectType = (typeof agendaObjectTypes)[number]

export const agendaDiscussionStatuses = [
  "Te bespreken",
  "Besproken",
  "Doorgeschoven",
  "Ter info",
  "Geannuleerd",
] as const
export type AgendaDiscussionStatus = (typeof agendaDiscussionStatuses)[number]

export const reportStatuses = ["Concept", "Definitief", "Gereviseerd"] as const
export type ReportStatus = (typeof reportStatuses)[number]

export type TopicParentType = "Project" | "Cluster"
