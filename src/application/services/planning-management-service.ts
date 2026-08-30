import {
  validatePlanningDependency,
  validatePlanningEntry,
  type AuditFields,
  type DateTime,
  type LocalDate,
  type PlanningDependency,
  type PlanningEntry,
  type PlanningKind,
  type PlanningStatus,
  type PhaseIntensity,
  type ProjectPhase,
  type Milestone,
  type MilestoneStatus,
  type Resource,
  type ResourceAssignment,
  type ResourceType,
  type AllocationMode,
  type ProjectSize,
  type UUID,
} from "../../domain"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export interface PlanningEntryInput {
  projectId: UUID
  topicId?: UUID
  kind: PlanningKind
  title: string
  startDate?: LocalDate
  plannedEndDate: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  status: PlanningStatus
  isMilestone: boolean
}

export interface TopicTimingInput {
  startDate?: LocalDate
  plannedEndDate: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  status: PlanningStatus
  isMilestone: boolean
}

export interface PlanningDependencyInput {
  predecessorPlanningId: UUID
  successorPlanningId: UUID
}

export interface PlanningMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface ProjectPhaseInput {
  projectId: UUID
  name: string
  startDate: LocalDate
  endDate: LocalDate
  status: PlanningStatus
  progressPercent: number
  ownerActorId?: UUID
  intensity: PhaseIntensity
  dependsOnPhaseId?: UUID
  order?: number
}

export interface MilestoneInput {
  projectId: UUID
  phaseId?: UUID
  name: string
  date: LocalDate
  status: MilestoneStatus
  ownerActorId?: UUID
}

export interface ResourceInput {
  type: ResourceType
  name: string
  actorId?: UUID
  role?: string
  capacityFte: number
  projectAvailabilityFte: number
}

export interface ResourceAssignmentInput {
  projectId: UUID
  phaseId?: UUID
  resourceType: ResourceType
  resourceId?: UUID
  roleId?: UUID
  startDate: LocalDate
  endDate: LocalDate
  allocation: number
  allocationMode: AllocationMode
}

export type PlanningTemplateKey =
  | "nieuwbouw-groot"
  | "renovatie-klein"
  | "technische-installatie"
  | "onderhoudswerk"

interface PlanningTemplatePhase {
  name: string
  days: number
  intensity: PhaseIntensity
}

export const planningTemplates: Readonly<Record<PlanningTemplateKey, readonly PlanningTemplatePhase[]>> = {
  "nieuwbouw-groot": [
    { name: "Programma en haalbaarheid", days: 70, intensity: "Normaal" },
    { name: "Ontwerp", days: 140, intensity: "Hoog" },
    { name: "Aanbesteding", days: 70, intensity: "Normaal" },
    { name: "Uitvoering", days: 320, intensity: "Piek" },
    { name: "Oplevering en nazorg", days: 90, intensity: "Laag" },
  ],
  "renovatie-klein": [
    { name: "Opname en ontwerp", days: 35, intensity: "Normaal" },
    { name: "Prijsaanvraag", days: 28, intensity: "Laag" },
    { name: "Uitvoering", days: 70, intensity: "Hoog" },
    { name: "Oplevering", days: 14, intensity: "Laag" },
  ],
  "technische-installatie": [
    { name: "Analyse", days: 28, intensity: "Normaal" },
    { name: "Technisch ontwerp", days: 56, intensity: "Hoog" },
    { name: "Implementatie", days: 84, intensity: "Piek" },
    { name: "Test en ingebruikname", days: 28, intensity: "Normaal" },
  ],
  onderhoudswerk: [
    { name: "Inspectie", days: 7, intensity: "Laag" },
    { name: "Voorbereiding", days: 14, intensity: "Normaal" },
    { name: "Uitvoering", days: 21, intensity: "Hoog" },
    { name: "Controle", days: 7, intensity: "Laag" },
  ],
}

const sizeProfileFte: Readonly<Record<ProjectSize, number>> = {
  XS: 0.08, S: 0.15, M: 0.3, L: 0.5, XL: 0.8, XXL: 1.2,
}

export interface PlanningMutationResult<T> {
  state: NormalizedDomainState
  record: T
}

export interface PlanningManagementIssue {
  field: string
  message: string
}

export class PlanningManagementError extends Error {
  constructor(readonly issues: readonly PlanningManagementIssue[]) {
    super(issues[0]?.message ?? "De planninginvoer is ongeldig.")
    this.name = "PlanningManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function currentActorId(state: NormalizedDomainState): UUID | undefined {
  return state.records.config[0]?.currentActorId
}

function auditFields(now: Date, actorId?: UUID): AuditFields {
  const timestamp = now.toISOString() as DateTime
  return {
    createdAt: timestamp,
    ...(actorId ? { createdByActorId: actorId } : {}),
    updatedAt: timestamp,
    ...(actorId ? { updatedByActorId: actorId } : {}),
    active: true,
  }
}

function updateAudit(
  audit: AuditFields,
  now: Date,
  actorId?: UUID,
): AuditFields {
  return {
    ...audit,
    updatedAt: now.toISOString() as DateTime,
    ...(actorId ? { updatedByActorId: actorId } : {}),
  }
}

function addDays(date: LocalDate, days: number): LocalDate {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10) as LocalDate
}

function assertDateRange(startDate: LocalDate, endDate: LocalDate): void {
  if (endDate < startDate) {
    throw new PlanningManagementError([{ field: "endDate", message: "De einddatum mag niet voor de startdatum liggen." }])
  }
}

function assertActor(state: NormalizedDomainState, actorId?: UUID): void {
  if (actorId && !state.indices.actorById.get(actorId)?.active) {
    throw new PlanningManagementError([{ field: "ownerActorId", message: "Kies een actieve actor." }])
  }
}

function normalizedInput(input: PlanningEntryInput): PlanningEntryInput {
  const title = input.title.trim()
  const isMilestone = input.kind === "Milestone" || input.isMilestone
  return {
    projectId: input.projectId,
    ...(input.topicId ? { topicId: input.topicId } : {}),
    kind: input.kind,
    title,
    ...(!isMilestone && input.startDate ? { startDate: input.startDate } : {}),
    plannedEndDate: input.plannedEndDate,
    ...(input.actualEndDate ? { actualEndDate: input.actualEndDate } : {}),
    ...(input.progressPercent !== undefined
      ? { progressPercent: input.progressPercent }
      : isMilestone
        ? { progressPercent: 0 }
        : {}),
    status: input.status,
    isMilestone,
  }
}

function validateEntryInput(
  state: NormalizedDomainState,
  input: PlanningEntryInput,
  excludedEntryId?: UUID,
): void {
  const issues: PlanningManagementIssue[] = []
  if (!state.indices.projectById.has(input.projectId)) {
    issues.push({ field: "projectId", message: "Project niet gevonden." })
  }
  if (!input.title) {
    issues.push({ field: "title", message: "Titel is verplicht." })
  }
  if (input.topicId) {
    const topic = state.indices.topicById.get(input.topicId)
    if (!topic || topic.projectId !== input.projectId) {
      issues.push({
        field: "topicId",
        message: "Het topic hoort niet bij dit project.",
      })
    }
    if (input.kind !== "Topic") {
      issues.push({
        field: "kind",
        message: "Een topicplanning moet het type Topic behouden.",
      })
    }
    const existing = state.indices.planningByTopic
      .get(input.topicId)
      ?.find((entry) => entry.id !== excludedEntryId && entry.audit.active)
    if (existing) {
      issues.push({
        field: "topicId",
        message: "Dit topic heeft al een primaire planningentry.",
      })
    }
  } else if (input.kind === "Topic") {
    issues.push({
      field: "topicId",
      message: "Een planningitem van het type Topic vereist een topic.",
    })
  }
  for (const issue of validatePlanningEntry(input)) {
    issues.push({ field: issue.field, message: issue.message })
  }
  if (issues.length) throw new PlanningManagementError(issues)
}

export class PlanningManagementService {
  createPhase(state: NormalizedDomainState, input: ProjectPhaseInput, options: PlanningMutationOptions = {}): PlanningMutationResult<ProjectPhase> {
    if (!state.indices.projectById.has(input.projectId)) throw new PlanningManagementError([{ field: "projectId", message: "Project niet gevonden." }])
    if (!input.name.trim()) throw new PlanningManagementError([{ field: "name", message: "Fasenaam is verplicht." }])
    assertDateRange(input.startDate, input.endDate)
    assertActor(state, input.ownerActorId)
    if (input.progressPercent < 0 || input.progressPercent > 100) throw new PlanningManagementError([{ field: "progressPercent", message: "Voortgang moet tussen 0 en 100 procent liggen." }])
    if (input.dependsOnPhaseId && state.indices.projectPhaseById.get(input.dependsOnPhaseId)?.projectId !== input.projectId) throw new PlanningManagementError([{ field: "dependsOnPhaseId", message: "De voorganger moet een fase van hetzelfde project zijn." }])
    const now = options.now ?? new Date()
    const siblings = state.indices.phasesByProject.get(input.projectId) ?? []
    const record: ProjectPhase = { id: (options.createUuid ?? defaultUuid)(), ...input, name: input.name.trim(), order: input.order ?? Math.max(0, ...siblings.map((item) => item.order)) + 1, audit: auditFields(now, currentActorId(state)) }
    const records = cloneDomainCollections(state.records)
    records.projectPhases.push(record)
    return { state: normalizeDomainState(records), record }
  }

  updatePhase(state: NormalizedDomainState, phaseId: UUID, input: ProjectPhaseInput, options: PlanningMutationOptions = {}): PlanningMutationResult<ProjectPhase> {
    const existing = state.indices.projectPhaseById.get(phaseId)
    if (!existing) throw new PlanningManagementError([{ field: "phaseId", message: "Fase niet gevonden." }])
    if (input.dependsOnPhaseId === phaseId) throw new PlanningManagementError([{ field: "dependsOnPhaseId", message: "Een fase kan niet van zichzelf afhangen." }])
    assertDateRange(input.startDate, input.endDate)
    assertActor(state, input.ownerActorId)
    const record: ProjectPhase = { ...existing, ...input, name: input.name.trim(), order: input.order ?? existing.order, audit: updateAudit(existing.audit, options.now ?? new Date(), currentActorId(state)) }
    const records = cloneDomainCollections(state.records)
    records.projectPhases[records.projectPhases.findIndex((item) => item.id === phaseId)] = record
    const byId = new Map(records.projectPhases.map((item) => [item.id, item]))
    let cursor = record.dependsOnPhaseId
    const seen = new Set<UUID>([record.id])
    while (cursor) {
      if (seen.has(cursor)) throw new PlanningManagementError([{ field: "dependsOnPhaseId", message: "Deze afhankelijkheid zou een cyclus in de fasering maken." }])
      seen.add(cursor)
      cursor = byId.get(cursor)?.dependsOnPhaseId
    }
    return { state: normalizeDomainState(records), record }
  }

  createMilestone(state: NormalizedDomainState, input: MilestoneInput, options: PlanningMutationOptions = {}): PlanningMutationResult<Milestone> {
    if (!state.indices.projectById.has(input.projectId)) throw new PlanningManagementError([{ field: "projectId", message: "Project niet gevonden." }])
    if (!input.name.trim()) throw new PlanningManagementError([{ field: "name", message: "Naam van de mijlpaal is verplicht." }])
    if (input.phaseId && state.indices.projectPhaseById.get(input.phaseId)?.projectId !== input.projectId) throw new PlanningManagementError([{ field: "phaseId", message: "De fase hoort niet bij dit project." }])
    assertActor(state, input.ownerActorId)
    const now = options.now ?? new Date()
    const record: Milestone = { id: (options.createUuid ?? defaultUuid)(), ...input, name: input.name.trim(), audit: auditFields(now, currentActorId(state)) }
    const records = cloneDomainCollections(state.records)
    records.milestones.push(record)
    return { state: normalizeDomainState(records), record }
  }

  createResource(state: NormalizedDomainState, input: ResourceInput, options: PlanningMutationOptions = {}): PlanningMutationResult<Resource> {
    if (!input.name.trim()) throw new PlanningManagementError([{ field: "name", message: "Resourcenaam is verplicht." }])
    if (input.capacityFte < 0 || input.projectAvailabilityFte < 0 || input.projectAvailabilityFte > input.capacityFte) throw new PlanningManagementError([{ field: "projectAvailabilityFte", message: "Projectbeschikbaarheid moet tussen 0 en de totale capaciteit liggen." }])
    if (input.actorId && !state.indices.actorById.has(input.actorId)) throw new PlanningManagementError([{ field: "actorId", message: "Actor niet gevonden." }])
    const now = options.now ?? new Date()
    const record: Resource = { id: (options.createUuid ?? defaultUuid)(), ...input, name: input.name.trim(), audit: auditFields(now, currentActorId(state)) }
    const records = cloneDomainCollections(state.records)
    records.resources.push(record)
    return { state: normalizeDomainState(records), record }
  }

  createAssignment(state: NormalizedDomainState, input: ResourceAssignmentInput, options: PlanningMutationOptions = {}): PlanningMutationResult<ResourceAssignment> {
    if (!state.indices.projectById.has(input.projectId)) throw new PlanningManagementError([{ field: "projectId", message: "Project niet gevonden." }])
    assertDateRange(input.startDate, input.endDate)
    if (input.allocation < 0) throw new PlanningManagementError([{ field: "allocation", message: "Inzet kan niet negatief zijn." }])
    if (!input.resourceId && !input.roleId) throw new PlanningManagementError([{ field: "resourceId", message: "Kies een persoon, rol of andere resource." }])
    const resource = state.indices.resourceById.get((input.resourceId ?? input.roleId)!)
    if (!resource) throw new PlanningManagementError([{ field: "resourceId", message: "Resource niet gevonden." }])
    if (input.phaseId && state.indices.projectPhaseById.get(input.phaseId)?.projectId !== input.projectId) throw new PlanningManagementError([{ field: "phaseId", message: "De fase hoort niet bij dit project." }])
    const now = options.now ?? new Date()
    const record: ResourceAssignment = { id: (options.createUuid ?? defaultUuid)(), ...input, resourceType: resource.type, audit: auditFields(now, currentActorId(state)) }
    const records = cloneDomainCollections(state.records)
    records.resourceAssignments.push(record)
    return { state: normalizeDomainState(records), record }
  }

  applyTemplate(state: NormalizedDomainState, projectId: UUID, templateKey: PlanningTemplateKey, options: PlanningMutationOptions = {}): PlanningMutationResult<readonly ProjectPhase[]> {
    const project = state.indices.projectById.get(projectId)
    if (!project) throw new PlanningManagementError([{ field: "projectId", message: "Project niet gevonden." }])
    if ((state.indices.phasesByProject.get(projectId) ?? []).some((item) => item.audit.active)) throw new PlanningManagementError([{ field: "template", message: "Dit project heeft al fases. Pas die eerst aan of verwijder ze." }])
    let nextState = state
    let cursor = project.startDate ?? (new Date().toISOString().slice(0, 10) as LocalDate)
    let predecessorId: UUID | undefined
    const phases: ProjectPhase[] = []
    for (const [index, definition] of planningTemplates[templateKey].entries()) {
      const result = this.createPhase(nextState, { projectId, name: definition.name, startDate: cursor, endDate: addDays(cursor, definition.days - 1), status: "Niet gestart", progressPercent: 0, intensity: definition.intensity, ...(predecessorId ? { dependsOnPhaseId: predecessorId } : {}), order: index + 1 }, options)
      nextState = result.state
      phases.push(result.record)
      predecessorId = result.record.id
      cursor = addDays(result.record.endDate, 1)
    }
    if (project.size) {
      const roleResult = this.createResource(nextState, { type: "role", name: `Projectteam ${project.code}`, role: "Projectteam", capacityFte: Math.max(1, sizeProfileFte[project.size] * 2), projectAvailabilityFte: Math.max(1, sizeProfileFte[project.size] * 2) }, options)
      nextState = roleResult.state
      for (const phase of phases) {
        const assignment = this.createAssignment(nextState, { projectId, phaseId: phase.id, resourceType: "role", roleId: roleResult.record.id, startDate: phase.startDate, endDate: phase.endDate, allocation: sizeProfileFte[project.size], allocationMode: "indicative" }, options)
        nextState = assignment.state
      }
    }
    return { state: nextState, record: phases }
  }

  createEntry(
    state: NormalizedDomainState,
    rawInput: PlanningEntryInput,
    options: PlanningMutationOptions = {},
  ): PlanningMutationResult<PlanningEntry> {
    const input = normalizedInput(rawInput)
    validateEntryInput(state, input)
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const siblings = state.indices.planningByProject.get(input.projectId) ?? []
    const record: PlanningEntry = {
      id: (options.createUuid ?? defaultUuid)(),
      ...input,
      order: Math.max(0, ...siblings.map((entry) => entry.order)) + 1,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.planning.push(record)
    return { state: normalizeDomainState(records), record }
  }

  updateEntry(
    state: NormalizedDomainState,
    entryId: UUID,
    rawInput: PlanningEntryInput,
    options: PlanningMutationOptions = {},
  ): PlanningMutationResult<PlanningEntry> {
    const existing = state.indices.planningById.get(entryId)
    if (!existing || !existing.audit.active) {
      throw new PlanningManagementError([
        { field: "planning", message: "Planningitem niet gevonden." },
      ])
    }
    const input = normalizedInput(rawInput)
    validateEntryInput(state, input, existing.id)
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const record: PlanningEntry = {
      ...existing,
      ...input,
      audit: updateAudit(existing.audit, now, actorId),
    }
    if (!input.topicId) delete record.topicId
    if (!input.startDate) delete record.startDate
    if (!input.actualEndDate) delete record.actualEndDate
    if (input.progressPercent === undefined) delete record.progressPercent
    const records = cloneDomainCollections(state.records)
    const index = records.planning.findIndex((entry) => entry.id === entryId)
    records.planning[index] = record
    return { state: normalizeDomainState(records), record }
  }

  saveTopicTiming(
    state: NormalizedDomainState,
    topicId: UUID,
    input: TopicTimingInput,
    options: PlanningMutationOptions = {},
  ): PlanningMutationResult<PlanningEntry> {
    const topic = state.indices.topicById.get(topicId)
    if (!topic?.projectId || !topic.audit.active) {
      throw new PlanningManagementError([
        {
          field: "topicId",
          message: "Alleen een actief projecttopic kan timing krijgen.",
        },
      ])
    }
    const existing = state.indices.planningByTopic
      .get(topic.id)
      ?.filter((entry) => entry.audit.active)
    if ((existing?.length ?? 0) > 1) {
      throw new PlanningManagementError([
        {
          field: "topicId",
          message: "Dit topic bevat meer dan één primaire planningentry.",
        },
      ])
    }
    const entryInput: PlanningEntryInput = {
      projectId: topic.projectId,
      topicId: topic.id,
      kind: "Topic",
      title: topic.title,
      ...(input.startDate ? { startDate: input.startDate } : {}),
      plannedEndDate: input.plannedEndDate,
      ...(input.actualEndDate ? { actualEndDate: input.actualEndDate } : {}),
      ...(input.progressPercent !== undefined
        ? { progressPercent: input.progressPercent }
        : {}),
      status: input.status,
      isMilestone: input.isMilestone,
    }
    return existing?.[0]
      ? this.updateEntry(state, existing[0].id, entryInput, options)
      : this.createEntry(state, entryInput, options)
  }

  createDependency(
    state: NormalizedDomainState,
    input: PlanningDependencyInput,
    options: PlanningMutationOptions = {},
  ): PlanningMutationResult<PlanningDependency> {
    const dependencyInput = { ...input, type: "FinishToStart" as const }
    const issues = validatePlanningDependency(
      state.records.planning,
      state.records.planningDependencies,
      dependencyInput,
    )
    if (issues.length) {
      throw new PlanningManagementError(
        issues.map((issue) => ({ field: issue.field, message: issue.message })),
      )
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const record: PlanningDependency = {
      id: (options.createUuid ?? defaultUuid)(),
      ...dependencyInput,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.planningDependencies.push(record)
    return { state: normalizeDomainState(records), record }
  }
}
