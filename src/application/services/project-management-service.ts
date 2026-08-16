import type {
  Actor,
  ActorType,
  AuditFields,
  Cluster,
  DateTime,
  LocalDate,
  Project,
  ProjectClusterHistory,
  ProjectStatus,
  ProjectSize,
  UUID,
} from "../../domain"
import { validateProject } from "../../domain"
import { todayAsLocalDate } from "../../utils"
import {
  normalizeDomainState,
  type NormalizedDomainState,
} from "./domain-state"
import { cloneDomainCollections } from "./semantic-comparison"

export interface ProjectInput {
  code: string
  title: string
  description: string
  chapterId: UUID
  clusterId?: UUID
  status: ProjectStatus
  phase: string
  site?: string
  location?: string
  department?: string
  coordinatorActorId?: UUID
  startDate?: LocalDate
  plannedEndDate?: LocalDate
  actualEndDate?: LocalDate
  progressPercent?: number
  size?: ProjectSize
  documentsUrl?: string
}

export interface ClusterInput {
  chapterId: UUID
  code: string
  title: string
  description?: string
}

export interface ActorInput {
  displayName: string
  type: ActorType
  email?: string
  organization?: string
  role?: string
  active: boolean
}

export interface ProjectMutationOptions {
  now?: Date
  createUuid?: () => UUID
}

export interface ProjectMutationResult<T> {
  state: NormalizedDomainState
  record: T
}

export interface ProjectManagementIssue {
  field: string
  message: string
}

export class ProjectManagementError extends Error {
  constructor(readonly issues: readonly ProjectManagementIssue[]) {
    super(issues[0]?.message ?? "De invoer is ongeldig.")
    this.name = "ProjectManagementError"
  }
}

function defaultUuid(): UUID {
  return crypto.randomUUID() as UUID
}

function optionalText(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function requiredText(value: string): string {
  return value.trim()
}

function auditFields(now: Date, actorId?: UUID, active = true): AuditFields {
  const timestamp = now.toISOString() as DateTime
  return {
    createdAt: timestamp,
    ...(actorId ? { createdByActorId: actorId } : {}),
    updatedAt: timestamp,
    ...(actorId ? { updatedByActorId: actorId } : {}),
    active,
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

function validateProjectInput(
  state: NormalizedDomainState,
  input: ProjectInput,
): void {
  const issues: ProjectManagementIssue[] = []
  if (!requiredText(input.code)) {
    issues.push({ field: "code", message: "Projectcode is verplicht." })
  }
  if (!requiredText(input.title)) {
    issues.push({ field: "title", message: "Titel is verplicht." })
  }
  if (!state.indices.chapterById.has(input.chapterId)) {
    issues.push({ field: "chapterId", message: "Kies een geldig hoofdstuk." })
  }

  const cluster = input.clusterId
    ? state.indices.clusterById.get(input.clusterId)
    : undefined
  for (const issue of validateProject(input, cluster)) {
    issues.push({ field: issue.field, message: issue.message })
  }

  if (
    input.startDate &&
    input.plannedEndDate &&
    input.plannedEndDate < input.startDate
  ) {
    issues.push({
      field: "plannedEndDate",
      message: "De geplande einddatum mag niet vóór de startdatum liggen.",
    })
  }

  if (input.coordinatorActorId) {
    const actor = state.indices.actorById.get(input.coordinatorActorId)
    if (!actor?.active) {
      issues.push({
        field: "coordinatorActorId",
        message: "De projectcoördinator moet een actieve actor zijn.",
      })
    }
  }

  if (issues.length) throw new ProjectManagementError(issues)
}

function normalizedProjectInput(input: ProjectInput): ProjectInput {
  const site = optionalText(input.site)
  const location = optionalText(input.location)
  const department = optionalText(input.department)
  const documentsUrl = optionalText(input.documentsUrl)
  return {
    code: requiredText(input.code),
    title: requiredText(input.title),
    description: input.description.trim(),
    chapterId: input.chapterId,
    ...(input.clusterId ? { clusterId: input.clusterId } : {}),
    status: input.status,
    phase: input.phase.trim(),
    ...(input.coordinatorActorId
      ? { coordinatorActorId: input.coordinatorActorId }
      : {}),
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.plannedEndDate ? { plannedEndDate: input.plannedEndDate } : {}),
    ...(input.actualEndDate ? { actualEndDate: input.actualEndDate } : {}),
    ...(input.progressPercent !== undefined
      ? { progressPercent: input.progressPercent }
      : {}),
    ...(input.size ? { size: input.size } : {}),
    ...(site ? { site } : {}),
    ...(location ? { location } : {}),
    ...(department ? { department } : {}),
    ...(documentsUrl ? { documentsUrl } : {}),
  }
}

function createHistory(
  projectId: UUID,
  clusterId: UUID,
  reason: string,
  now: Date,
  actorId: UUID | undefined,
  createUuid: () => UUID,
): ProjectClusterHistory {
  return {
    id: createUuid(),
    projectId,
    clusterId,
    validFrom: todayAsLocalDate(now) as LocalDate,
    reason,
    ...(actorId ? { authorActorId: actorId } : {}),
    audit: auditFields(now, actorId),
  }
}

export class ProjectManagementService {
  createProject(
    state: NormalizedDomainState,
    input: ProjectInput,
    options: ProjectMutationOptions = {},
  ): ProjectMutationResult<Project> {
    validateProjectInput(state, input)
    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = currentActorId(state)
    const normalized = normalizedProjectInput(input)
    const project: Project = {
      id: createUuid(),
      ...normalized,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.projects.push(project)
    if (project.clusterId) {
      records.projectClusterHistory.push(
        createHistory(
          project.id,
          project.clusterId,
          "Project aangemaakt",
          now,
          actorId,
          createUuid,
        ),
      )
    }
    return { state: normalizeDomainState(records), record: project }
  }

  updateProject(
    state: NormalizedDomainState,
    projectId: UUID,
    input: ProjectInput,
    options: ProjectMutationOptions = {},
  ): ProjectMutationResult<Project> {
    validateProjectInput(state, input)
    const existing = state.indices.projectById.get(projectId)
    if (!existing) {
      throw new ProjectManagementError([
        { field: "project", message: "Project niet gevonden." },
      ])
    }

    const now = options.now ?? new Date()
    const createUuid = options.createUuid ?? defaultUuid
    const actorId = currentActorId(state)
    const normalized = normalizedProjectInput(input)
    const records = cloneDomainCollections(state.records)
    const projectIndex = records.projects.findIndex(
      (project) => project.id === projectId,
    )
    const project: Project = {
      ...existing,
      ...normalized,
      audit: updateAudit(existing.audit, now, actorId),
    }
    const optionalEditableFields = [
      "clusterId",
      "site",
      "location",
      "department",
      "coordinatorActorId",
      "startDate",
      "plannedEndDate",
      "actualEndDate",
      "progressPercent",
      "size",
      "documentsUrl",
    ] as const
    for (const field of optionalEditableFields) {
      if (!(field in normalized)) delete project[field]
    }
    records.projects[projectIndex] = project

    if (existing.clusterId !== project.clusterId) {
      for (const history of records.projectClusterHistory) {
        if (history.projectId !== projectId || history.validTo) continue
        history.validTo = todayAsLocalDate(now) as LocalDate
        history.audit = updateAudit(history.audit, now, actorId)
      }
      if (project.clusterId) {
        records.projectClusterHistory.push(
          createHistory(
            project.id,
            project.clusterId,
            existing.clusterId ? "Cluster gewijzigd" : "Cluster toegevoegd",
            now,
            actorId,
            createUuid,
          ),
        )
      }
    }

    return { state: normalizeDomainState(records), record: project }
  }

  createCluster(
    state: NormalizedDomainState,
    input: ClusterInput,
    options: ProjectMutationOptions = {},
  ): ProjectMutationResult<Cluster> {
    const issues: ProjectManagementIssue[] = []
    if (!state.indices.chapterById.has(input.chapterId)) {
      issues.push({ field: "chapterId", message: "Kies eerst een hoofdstuk." })
    }
    if (!requiredText(input.title)) {
      issues.push({ field: "title", message: "Clusternaam is verplicht." })
    }
    if (!requiredText(input.code)) {
      issues.push({ field: "code", message: "Clustercode is verplicht." })
    }
    if (issues.length) throw new ProjectManagementError(issues)

    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const cluster: Cluster = {
      id: (options.createUuid ?? defaultUuid)(),
      chapterId: input.chapterId,
      code: requiredText(input.code),
      title: requiredText(input.title),
      description: input.description?.trim() ?? "",
      status: "Active",
      order:
        Math.max(
          0,
          ...state.records.clusters
            .filter((item) => item.chapterId === input.chapterId)
            .map((item) => item.order),
        ) + 1,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.clusters.push(cluster)
    return { state: normalizeDomainState(records), record: cluster }
  }

  createActor(
    state: NormalizedDomainState,
    input: ActorInput,
    options: ProjectMutationOptions = {},
  ): ProjectMutationResult<Actor> {
    if (!requiredText(input.displayName)) {
      throw new ProjectManagementError([
        { field: "displayName", message: "Naam is verplicht." },
      ])
    }
    const now = options.now ?? new Date()
    const actorId = currentActorId(state)
    const email = optionalText(input.email)
    const organization = optionalText(input.organization)
    const role = optionalText(input.role)
    const actor: Actor = {
      id: (options.createUuid ?? defaultUuid)(),
      displayName: requiredText(input.displayName),
      type: input.type,
      ...(email ? { email } : {}),
      ...(organization ? { organization } : {}),
      ...(role ? { role } : {}),
      active: input.active,
      audit: auditFields(now, actorId),
    }
    const records = cloneDomainCollections(state.records)
    records.actors.push(actor)
    return { state: normalizeDomainState(records), record: actor }
  }
}
