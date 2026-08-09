import type {
  AuditFields,
  DateTime,
  LocalDate,
  ObjectType,
  Update,
  UpdateType,
  UUID,
} from "../../domain"
import { validateAgendaObjectScope } from "../../domain"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export type UpdateContextType = Extract<
  ObjectType,
  "Project" | "Cluster" | "Topic" | "Action" | "Meeting"
>

export interface UpdateInput {
  objectType: UpdateContextType
  objectId: UUID
  meetingId?: UUID
  type: UpdateType
  date: LocalDate
  text: string
  makeCurrent?: boolean
}

export interface UpdateMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface UpdateMutationResult {
  state: NormalizedDomainState
  record: Update
}

export interface UpdateManagementIssue {
  field: string
  message: string
}

export class UpdateManagementError extends Error {
  constructor(readonly issues: readonly UpdateManagementIssue[]) {
    super(issues[0]?.message ?? "De bijdrage is ongeldig.")
    this.name = "UpdateManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function auditFields(now: Date, actorId: UUID): AuditFields {
  const timestamp = now.toISOString() as DateTime
  return {
    createdAt: timestamp,
    createdByActorId: actorId,
    updatedAt: timestamp,
    updatedByActorId: actorId,
    active: true,
  }
}

function activeCurrentActorId(state: NormalizedDomainState): UUID {
  const actorId = state.records.config[0]?.currentActorId
  const actor = actorId ? state.indices.actorById.get(actorId) : undefined
  if (!actor?.active || !actor.audit.active) {
    throw new UpdateManagementError([
      {
        field: "authorActorId",
        message:
          "Kies een actieve huidige actor voordat je een bijdrage toevoegt.",
      },
    ])
  }
  return actor.id
}

function objectExists(
  state: NormalizedDomainState,
  objectType: UpdateContextType,
  objectId: UUID,
): boolean {
  if (objectType === "Project") return state.indices.projectById.has(objectId)
  if (objectType === "Cluster") return state.indices.clusterById.has(objectId)
  if (objectType === "Topic") return state.indices.topicById.has(objectId)
  if (objectType === "Action") return state.indices.actionById.has(objectId)
  return state.indices.meetingById.has(objectId)
}

export class UpdateManagementService {
  addUpdate(
    state: NormalizedDomainState,
    input: UpdateInput,
    options: UpdateMutationOptions = {},
  ): UpdateMutationResult {
    const issues: UpdateManagementIssue[] = []
    const text = input.text.trim()
    if (!objectExists(state, input.objectType, input.objectId)) {
      issues.push({
        field: "objectId",
        message: "De broncontext bestaat niet.",
      })
    }
    if (!text) {
      issues.push({ field: "text", message: "Tekst is verplicht." })
    }
    if (
      input.meetingId &&
      !state.indices.meetingById.get(input.meetingId)?.audit.active
    ) {
      issues.push({
        field: "meetingId",
        message: "Het bronoverleg bestaat niet.",
      })
    }
    if (input.meetingId) {
      const meeting = state.indices.meetingById.get(input.meetingId)
      const inScope =
        meeting && input.objectType === "Meeting"
          ? input.objectId === meeting.id
          : meeting &&
              (input.objectType === "Project" ||
                input.objectType === "Cluster" ||
                input.objectType === "Topic" ||
                input.objectType === "Action")
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
          message: "De bijdrage valt buiten de scope van het bronoverleg.",
        })
      }
    }
    if (
      input.makeCurrent &&
      !(["Project", "Cluster", "Topic"] as UpdateContextType[]).includes(
        input.objectType,
      )
    ) {
      issues.push({
        field: "makeCurrent",
        message: "Deze broncontext ondersteunt geen actuele stand.",
      })
    }
    if (issues.length) throw new UpdateManagementError(issues)

    const now = options.now ?? new Date()
    const actorId = activeCurrentActorId(state)
    const record: Update = {
      id: (options.createUuid ?? defaultUuid)(),
      objectType: input.objectType,
      objectId: input.objectId,
      ...(input.meetingId ? { meetingId: input.meetingId } : {}),
      type: input.type,
      date: input.date,
      authorActorId: actorId,
      text,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.updates.push(record)

    if (input.makeCurrent) {
      const collection =
        input.objectType === "Project"
          ? records.projects
          : input.objectType === "Cluster"
            ? records.clusters
            : records.topics
      const index = collection.findIndex((item) => item.id === input.objectId)
      const source = collection[index]
      if (source) {
        collection[index] = {
          ...source,
          currentUpdateId: record.id,
          audit: {
            ...source.audit,
            updatedAt: now.toISOString() as DateTime,
            updatedByActorId: actorId,
          },
        }
      }
    }

    return { state: normalizeDomainState(records), record }
  }
}
