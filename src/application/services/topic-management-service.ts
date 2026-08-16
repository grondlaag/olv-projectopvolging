import type {
  AuditFields,
  DateTime,
  LocalDate,
  Priority,
  Topic,
  TopicParentType,
  TopicStatus,
  Update,
  UUID,
} from "../../domain"
import { validateTopicParent } from "../../domain"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"
import {
  UpdateManagementError,
  UpdateManagementService,
} from "./update-management-service"

export type TopicJournalEntryType =
  "Update" | "Notitie" | "Overlegbijdrage" | "Beslissing"

export interface TopicInput {
  parentType: TopicParentType
  projectId?: UUID
  clusterId?: UUID
  code: string
  title: string
  context: string
  ownerActorId?: UUID
  priority: Priority
}

export interface TopicJournalEntryInput {
  authorActorId?: UUID
  type: TopicJournalEntryType
  date: LocalDate
  text: string
  makeCurrent?: boolean
  meetingId?: UUID
}

export interface TopicMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface TopicMutationResult<T> {
  state: NormalizedDomainState
  record: T
}

export interface TopicManagementIssue {
  field: string
  message: string
}

export class TopicManagementError extends Error {
  constructor(readonly issues: readonly TopicManagementIssue[]) {
    super(issues[0]?.message ?? "De topicinvoer is ongeldig.")
    this.name = "TopicManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function requiredText(value: string): string {
  return value.trim()
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

function currentActorId(state: NormalizedDomainState): UUID | undefined {
  return state.records.config[0]?.currentActorId
}

function validateTopicInput(
  state: NormalizedDomainState,
  input: TopicInput,
): void {
  const issues: TopicManagementIssue[] = []
  if (!requiredText(input.code)) {
    issues.push({ field: "code", message: "Topiccode is verplicht." })
  }
  if (!requiredText(input.title)) {
    issues.push({ field: "title", message: "Titel is verplicht." })
  }
  if (!requiredText(input.context)) {
    issues.push({ field: "context", message: "Vaste context is verplicht." })
  }

  for (const issue of validateTopicParent(input)) {
    issues.push({ field: issue.field, message: issue.message })
  }

  if (input.projectId && !state.indices.projectById.has(input.projectId)) {
    issues.push({ field: "parentType", message: "Project niet gevonden." })
  }
  if (input.clusterId && !state.indices.clusterById.has(input.clusterId)) {
    issues.push({ field: "parentType", message: "Cluster niet gevonden." })
  }
  if (input.ownerActorId) {
    const owner = state.indices.actorById.get(input.ownerActorId)
    if (!owner?.active || !owner.audit.active) {
      issues.push({
        field: "ownerActorId",
        message: "De eigenaar moet een actieve actor zijn.",
      })
    }
  }

  if (issues.length) throw new TopicManagementError(issues)
}

function validateJournalEntry(
  state: NormalizedDomainState,
  topicId: UUID,
  input: TopicJournalEntryInput,
): Topic {
  const topic = state.indices.topicById.get(topicId)
  const issues: TopicManagementIssue[] = []
  if (!topic || !topic.audit.active) {
    issues.push({ field: "topic", message: "Topic niet gevonden." })
  }
  if (!requiredText(input.text)) {
    issues.push({ field: "text", message: "Tekst is verplicht." })
  }
  if (issues.length) throw new TopicManagementError(issues)
  return topic!
}

function parentTopics(
  state: NormalizedDomainState,
  input: TopicInput,
): readonly Topic[] {
  return input.parentType === "Project" && input.projectId
    ? (state.indices.topicsByProject.get(input.projectId) ?? [])
    : input.clusterId
      ? (state.indices.topicsByCluster.get(input.clusterId) ?? [])
      : []
}

export function validateTopicCurrentUpdate(
  state: NormalizedDomainState,
  topic: Topic,
): boolean {
  if (!topic.currentUpdateId) return true
  const update = state.indices.updateById.get(topic.currentUpdateId)
  return Boolean(
    update?.audit.active &&
    update.objectType === "Topic" &&
    update.objectId === topic.id,
  )
}

export class TopicManagementService {
  private readonly updateService = new UpdateManagementService()

  createTopic(
    state: NormalizedDomainState,
    input: TopicInput,
    options: TopicMutationOptions = {},
  ): TopicMutationResult<Topic> {
    validateTopicInput(state, input)
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const siblings = parentTopics(state, input)
    const topic: Topic = {
      id: (options.createUuid ?? defaultUuid)(),
      parentType: input.parentType,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.clusterId ? { clusterId: input.clusterId } : {}),
      code: requiredText(input.code),
      title: requiredText(input.title),
      context: requiredText(input.context),
      ...(input.ownerActorId ? { ownerActorId: input.ownerActorId } : {}),
      priority: input.priority,
      status: "Open",
      order: Math.max(0, ...siblings.map((item) => item.order)) + 1,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.topics.push(topic)
    return { state: normalizeDomainState(records), record: topic }
  }

  addJournalEntry(
    state: NormalizedDomainState,
    topicId: UUID,
    input: TopicJournalEntryInput,
    options: TopicMutationOptions = {},
  ): TopicMutationResult<Update> {
    const topic = validateJournalEntry(state, topicId, input)
    try {
      const result = this.updateService.addUpdate(
        state,
        {
          objectType: "Topic",
          objectId: topic.id,
          ...(input.meetingId ? { meetingId: input.meetingId } : {}),
          ...(input.authorActorId
            ? { authorActorId: input.authorActorId }
            : {}),
          type: input.type,
          date: input.date,
          text: input.text,
          ...(input.makeCurrent ? { makeCurrent: true } : {}),
        },
        options,
      )
      const nextTopic = result.state.indices.topicById.get(topic.id)!
      if (!validateTopicCurrentUpdate(result.state, nextTopic)) {
        throw new TopicManagementError([
          {
            field: "currentUpdateId",
            message:
              "De actuele stand moet een actieve update van dit topic zijn.",
          },
        ])
      }
      return result
    } catch (error) {
      if (error instanceof UpdateManagementError) {
        throw new TopicManagementError(error.issues)
      }
      throw error
    }
  }

  setTopicStatus(
    state: NormalizedDomainState,
    topicId: UUID,
    status: TopicStatus,
    options: TopicMutationOptions = {},
  ): TopicMutationResult<Topic> {
    const topic = state.indices.topicById.get(topicId)
    if (!topic || !topic.audit.active) {
      throw new TopicManagementError([
        { field: "topic", message: "Topic niet gevonden." },
      ])
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const updated: Topic = {
      ...topic,
      status,
      audit: updateAudit(topic.audit, now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    const topicIndex = records.topics.findIndex((item) => item.id === topic.id)
    records.topics[topicIndex] = updated
    return { state: normalizeDomainState(records), record: updated }
  }

  archiveTopic(
    state: NormalizedDomainState,
    topicId: UUID,
    options: TopicMutationOptions = {},
  ): TopicMutationResult<Topic> {
    const topic = state.indices.topicById.get(topicId)
    if (!topic?.audit.active) {
      throw new TopicManagementError([
        { field: "topic", message: "Topic niet gevonden." },
      ])
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const updated: Topic = {
      ...topic,
      status: "Geannuleerd",
      audit: { ...updateAudit(topic.audit, now, actorId), active: false },
    }
    const records = cloneDomainCollections(state.records)
    const index = records.topics.findIndex((item) => item.id === topic.id)
    records.topics[index] = updated
    return { state: normalizeDomainState(records), record: updated }
  }
}
