import type { Action, Cluster, Meeting, Project, Topic } from "../entities"
import type { AgendaObjectType, MeetingScopeType, UUID } from "../value-objects"
import type { ValidationResult } from "./validation"

export interface MeetingScopeValidationInput {
  scopeType: MeetingScopeType
  scopeId?: UUID
}

export interface MeetingScopeReferences {
  chapterIds: ReadonlySet<UUID>
  clustersById: ReadonlyMap<UUID, Cluster>
  projectsById: ReadonlyMap<UUID, Project>
  topicsById: ReadonlyMap<UUID, Topic>
  actionsById: ReadonlyMap<UUID, Action>
}

export function validateMeetingScope(
  meeting: MeetingScopeValidationInput,
  references: Pick<
    MeetingScopeReferences,
    "chapterIds" | "clustersById" | "projectsById"
  >,
): ValidationResult {
  if (meeting.scopeType === "Portfolio") {
    return meeting.scopeId
      ? [
          {
            field: "scopeId",
            code: "meeting.scope.portfolio-id",
            message: "Een portfolio-overleg heeft geen scope-ID.",
          },
        ]
      : []
  }

  if (!meeting.scopeId) {
    return [
      {
        field: "scopeId",
        code: "meeting.scope.required",
        message: "Kies een geldige overlegscope.",
      },
    ]
  }

  const exists =
    meeting.scopeType === "Hoofdstuk"
      ? references.chapterIds.has(meeting.scopeId)
      : meeting.scopeType === "Cluster"
        ? references.clustersById.has(meeting.scopeId)
        : references.projectsById.has(meeting.scopeId)

  return exists
    ? []
    : [
        {
          field: "scopeId",
          code: "meeting.scope.unknown",
          message: "De gekozen overlegscope bestaat niet.",
        },
      ]
}

function projectMatchesScope(
  meeting: Pick<Meeting, "scopeType" | "scopeId">,
  project: Project,
): boolean {
  if (meeting.scopeType === "Portfolio") return true
  if (meeting.scopeType === "Project") return project.id === meeting.scopeId
  if (meeting.scopeType === "Hoofdstuk") {
    return project.chapterId === meeting.scopeId
  }
  if (meeting.scopeType === "Cluster") {
    return project.clusterId === meeting.scopeId
  }
  return false
}

export function isAgendaObjectInMeetingScope(
  meeting: Pick<Meeting, "scopeType" | "scopeId">,
  objectType: AgendaObjectType,
  objectId: UUID,
  references: MeetingScopeReferences,
): boolean {
  if (meeting.scopeType === "Portfolio") {
    if (objectType === "Project") return references.projectsById.has(objectId)
    if (objectType === "Cluster") return references.clustersById.has(objectId)
    if (objectType === "Topic") return references.topicsById.has(objectId)
    return references.actionsById.has(objectId)
  }

  if (objectType === "Project") {
    const project = references.projectsById.get(objectId)
    return Boolean(project && projectMatchesScope(meeting, project))
  }

  if (objectType === "Cluster") {
    const cluster = references.clustersById.get(objectId)
    if (!cluster) return false
    if (meeting.scopeType === "Hoofdstuk") {
      return cluster.chapterId === meeting.scopeId
    }
    return meeting.scopeType === "Cluster" && cluster.id === meeting.scopeId
  }

  if (objectType === "Topic") {
    const topic = references.topicsById.get(objectId)
    if (!topic) return false
    if (topic.projectId) {
      const project = references.projectsById.get(topic.projectId)
      return Boolean(project && projectMatchesScope(meeting, project))
    }
    const cluster = topic.clusterId
      ? references.clustersById.get(topic.clusterId)
      : undefined
    if (!cluster) return false
    if (meeting.scopeType === "Hoofdstuk") {
      return cluster.chapterId === meeting.scopeId
    }
    return meeting.scopeType === "Cluster" && cluster.id === meeting.scopeId
  }

  const action = references.actionsById.get(objectId)
  if (!action) return false
  if (
    action.objectType !== "Project" &&
    action.objectType !== "Cluster" &&
    action.objectType !== "Topic"
  ) {
    return false
  }
  return isAgendaObjectInMeetingScope(
    meeting,
    action.objectType,
    action.objectId,
    references,
  )
}

export function validateAgendaObjectScope(
  meeting: Pick<Meeting, "scopeType" | "scopeId">,
  objectType: AgendaObjectType | undefined,
  objectId: UUID | undefined,
  references: MeetingScopeReferences,
): ValidationResult {
  if (Boolean(objectType) !== Boolean(objectId)) {
    return [
      {
        field: "objectId",
        code: "meeting.agenda.object-pair",
        message: "Kies zowel een brontype als een bronrecord.",
      },
    ]
  }
  if (!objectType || !objectId) return []
  return isAgendaObjectInMeetingScope(meeting, objectType, objectId, references)
    ? []
    : [
        {
          field: "objectId",
          code: "meeting.agenda.out-of-scope",
          message: "Het gekozen record valt buiten de scope van dit overleg.",
        },
      ]
}
