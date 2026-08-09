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
