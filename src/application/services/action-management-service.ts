import type {
  Action,
  ActionHistory,
  ActionStatus,
  AuditFields,
  DateTime,
  LocalDate,
  ObjectType,
  Priority,
  UUID,
} from "../../domain"
import {
  validateActionCompletion,
  validateAgendaObjectScope,
} from "../../domain"
import { todayAsLocalDate } from "../../utils"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export type ActionContextType = Extract<
  ObjectType,
  "Project" | "Cluster" | "Topic" | "Meeting"
>

export interface ActionInput {
  objectType: ActionContextType
  objectId: UUID
  sourceMeetingId?: UUID
  title: string
  description?: string
  ownerActorId: UUID
  deadline?: LocalDate
  status: ActionStatus
  priority: Priority
  completedAt?: LocalDate
}

export interface ActionUpdateInput {
  title: string
  description?: string
  ownerActorId: UUID
  deadline?: LocalDate
  status: ActionStatus
  priority: Priority
  completedAt?: LocalDate
}

export interface ActionMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface ActionMutationResult<T> {
  state: NormalizedDomainState
  record: T
  history: readonly ActionHistory[]
}

export interface ActionManagementIssue {
  field: string
  message: string
}

export class ActionManagementError extends Error {
  constructor(readonly issues: readonly ActionManagementIssue[]) {
    super(issues[0]?.message ?? "De actie-invoer is ongeldig.")
    this.name = "ActionManagementError"
  }
}

const trackedFields = [
  "ownerActorId",
  "deadline",
  "status",
  "priority",
] as const

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function requiredText(value: string): string {
  return value.trim()
}

function optionalText(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
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
  actorId: UUID,
): AuditFields {
  return {
    ...audit,
    updatedAt: now.toISOString() as DateTime,
    updatedByActorId: actorId,
  }
}

function currentActorId(state: NormalizedDomainState): UUID | undefined {
  return state.records.config[0]?.currentActorId
}

function activeCurrentActorId(state: NormalizedDomainState): UUID {
  const actorId = currentActorId(state)
  const actor = actorId ? state.indices.actorById.get(actorId) : undefined
  if (!actor?.active || !actor.audit.active) {
    throw new ActionManagementError([
      {
        field: "changedByActorId",
        message: "Kies een actieve huidige actor voordat je een actie wijzigt.",
      },
    ])
  }
  return actor.id
}

function contextExists(
  state: NormalizedDomainState,
  objectType: ActionContextType,
  objectId: UUID,
): boolean {
  if (objectType === "Project") return state.indices.projectById.has(objectId)
  if (objectType === "Cluster") return state.indices.clusterById.has(objectId)
  if (objectType === "Topic") return state.indices.topicById.has(objectId)
  return state.records.meetings.some(
    (meeting) => meeting.id === objectId && meeting.audit.active,
  )
}

function validateInput(state: NormalizedDomainState, input: ActionInput): void {
  const issues: ActionManagementIssue[] = []
  if (!contextExists(state, input.objectType, input.objectId)) {
    issues.push({
      field: "objectId",
      message: `De gekozen ${input.objectType.toLocaleLowerCase("nl")}context bestaat niet.`,
    })
  }
  if (!requiredText(input.title)) {
    issues.push({ field: "title", message: "Titel is verplicht." })
  }
  const owner = state.indices.actorById.get(input.ownerActorId)
  if (!owner?.active || !owner.audit.active) {
    issues.push({
      field: "ownerActorId",
      message: "De eigenaar moet een actieve actor zijn.",
    })
  }
  if (
    input.sourceMeetingId &&
    !state.records.meetings.some(
      (meeting) => meeting.id === input.sourceMeetingId && meeting.audit.active,
    )
  ) {
    issues.push({
      field: "sourceMeetingId",
      message: "Het bronoverleg bestaat niet.",
    })
  }
  if (input.sourceMeetingId) {
    const meeting = state.indices.meetingById.get(input.sourceMeetingId)
    const inScope =
      meeting && input.objectType === "Meeting"
        ? input.objectId === meeting.id
        : meeting &&
            (input.objectType === "Project" ||
              input.objectType === "Cluster" ||
              input.objectType === "Topic")
          ? validateAgendaObjectScope(
              meeting,
              input.objectType,
              input.objectId,
              {
                chapterIds: new Set(
                  state.records.chapters.map((item) => item.id),
                ),
                clustersById: state.indices.clusterById,
                projectsById: state.indices.projectById,
                topicsById: state.indices.topicById,
                actionsById: state.indices.actionById,
              },
            ).length === 0
          : false
    if (!inScope) {
      issues.push({
        field: "objectId",
        message: "De actiecontext valt buiten de scope van het bronoverleg.",
      })
    }
  }
  for (const issue of validateActionCompletion(input)) {
    issues.push({ field: issue.field, message: issue.message })
  }
  if (issues.length) throw new ActionManagementError(issues)
}

function nextActionCode(state: NormalizedDomainState): string {
  const codes = new Set(state.records.actions.map((action) => action.code))
  let sequence = state.records.actions.length + 1
  let candidate = `ACT-${String(sequence).padStart(3, "0")}`
  while (codes.has(candidate)) {
    sequence += 1
    candidate = `ACT-${String(sequence).padStart(3, "0")}`
  }
  return candidate
}

function normalizeCompletion(
  input: ActionInput | ActionUpdateInput,
  now: Date,
  existingCompletedAt?: LocalDate,
): LocalDate | undefined {
  if (input.status !== "Afgerond") return undefined
  return (
    input.completedAt ??
    existingCompletedAt ??
    (todayAsLocalDate(now) as LocalDate)
  )
}

function createHistoryEntry(
  actionId: UUID,
  field: (typeof trackedFields)[number],
  previousValue: string | undefined,
  newValue: string | undefined,
  now: Date,
  actorId: UUID,
  createUuid: () => UUID,
): ActionHistory {
  return {
    id: createUuid(),
    actionId,
    changedAt: now.toISOString() as DateTime,
    changedByActorId: actorId,
    field,
    ...(previousValue ? { previousValue } : {}),
    ...(newValue ? { newValue } : {}),
    audit: auditFields(now, actorId),
  }
}

export class ActionManagementService {
  createAction(
    state: NormalizedDomainState,
    rawInput: ActionInput,
    options: ActionMutationOptions = {},
  ): ActionMutationResult<Action> {
    const now = options.now ?? new Date()
    const completedAt = normalizeCompletion(rawInput, now)
    const description = optionalText(rawInput.description)
    const input: ActionInput = {
      objectType: rawInput.objectType,
      objectId: rawInput.objectId,
      ...(rawInput.sourceMeetingId
        ? { sourceMeetingId: rawInput.sourceMeetingId }
        : {}),
      title: requiredText(rawInput.title),
      ...(description ? { description } : {}),
      ownerActorId: rawInput.ownerActorId,
      ...(rawInput.deadline ? { deadline: rawInput.deadline } : {}),
      status: rawInput.status,
      priority: rawInput.priority,
      ...(completedAt ? { completedAt } : {}),
    }
    if (!completedAt) delete input.completedAt
    validateInput(state, input)
    const actorId = currentActorId(state)
    const action: Action = {
      id: (options.createUuid ?? defaultUuid)(),
      objectType: input.objectType,
      objectId: input.objectId,
      ...(input.sourceMeetingId
        ? { sourceMeetingId: input.sourceMeetingId }
        : {}),
      code: nextActionCode(state),
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ownerActorId: input.ownerActorId,
      ...(input.deadline ? { deadline: input.deadline } : {}),
      status: input.status,
      priority: input.priority,
      ...(input.completedAt ? { completedAt: input.completedAt } : {}),
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.actions.push(action)
    return {
      state: normalizeDomainState(records),
      record: action,
      history: [],
    }
  }

  updateAction(
    state: NormalizedDomainState,
    actionId: UUID,
    rawInput: ActionUpdateInput,
    options: ActionMutationOptions = {},
  ): ActionMutationResult<Action> {
    const existing = state.indices.actionById.get(actionId)
    if (!existing || !existing.audit.active) {
      throw new ActionManagementError([
        { field: "action", message: "Actie niet gevonden." },
      ])
    }
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = activeCurrentActorId(state)
    const completedAt = normalizeCompletion(rawInput, now, existing.completedAt)
    const description = optionalText(rawInput.description)
    const input: ActionInput = {
      objectType: existing.objectType as ActionContextType,
      objectId: existing.objectId,
      ...(existing.sourceMeetingId
        ? { sourceMeetingId: existing.sourceMeetingId }
        : {}),
      title: requiredText(rawInput.title),
      ...(description ? { description } : {}),
      ownerActorId: rawInput.ownerActorId,
      ...(rawInput.deadline ? { deadline: rawInput.deadline } : {}),
      status: rawInput.status,
      priority: rawInput.priority,
      ...(completedAt ? { completedAt } : {}),
    }
    validateInput(state, input)

    const updated: Action = {
      ...existing,
      title: input.title,
      ownerActorId: input.ownerActorId,
      status: input.status,
      priority: input.priority,
      audit: updateAudit(existing.audit, now, actorId),
    }
    if (input.description) updated.description = input.description
    else delete updated.description
    if (input.deadline) updated.deadline = input.deadline
    else delete updated.deadline
    if (input.completedAt) updated.completedAt = input.completedAt
    else delete updated.completedAt

    const history = trackedFields.flatMap((field) => {
      const previousValue = existing[field]
      const newValue = updated[field]
      if (previousValue === newValue) return []
      return [
        createHistoryEntry(
          existing.id,
          field,
          previousValue,
          newValue,
          now,
          actorId,
          createUuid,
        ),
      ]
    })
    const records = cloneDomainCollections(state.records)
    const actionIndex = records.actions.findIndex(
      (action) => action.id === existing.id,
    )
    records.actions[actionIndex] = updated
    records.actionHistory.push(...history)
    return {
      state: normalizeDomainState(records),
      record: updated,
      history,
    }
  }
}
