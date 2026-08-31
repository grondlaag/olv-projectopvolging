import { phaseIntensityFactors, projectSizeFte } from "../../domain"
import type {
  Actor,
  Chapter,
  Cluster,
  PlanningDependency,
  PlanningEntry,
  PlanningStatus,
  ProjectSize,
  Project,
  ProjectPhase,
  Milestone,
  Resource,
  ResourceAssignment,
  Topic,
  UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"

const closedPlanningStatuses = new Set<PlanningStatus>([
  "Afgerond",
  "Geannuleerd",
])

export type PlanningZoom = "week" | "month" | "quarter" | "year"

export interface PlanningRow {
  id: string
  title: string
  subtitle: string
  depth: 0 | 1 | 2 | 3
  kind: "project" | "phase" | "topic" | "milestone" | "custom" | "resource"
  projectId: UUID
  entry?: PlanningEntry
  topic?: Topic
  actionId?: UUID
  updateId?: UUID
  owner?: Actor
  phase?: ProjectPhase
  milestone?: Milestone
  startDate?: string
  endDate?: string
  progressPercent: number
  status?: PlanningStatus
  isMilestone: boolean
  delayed: boolean
}

export interface ProjectPlanningModel {
  project: Project
  rows: readonly PlanningRow[]
  entries: readonly PlanningEntry[]
  dependencies: readonly PlanningDependency[]
  phases: readonly ProjectPhase[]
  milestones: readonly Milestone[]
  assignments: readonly ResourceAssignment[]
}

export interface GlobalPlanningFilters {
  chapterId: string
  clusterId: string
  projectId: string
  status: "" | PlanningStatus
  riskOnly: boolean
  delayedOnly: boolean
  ownerActorId: string
  resourceId?: string
  roleId?: string
  phase?: string
  planningStatus?: string
  includeActions?: boolean
}

export const defaultGlobalPlanningFilters: GlobalPlanningFilters = {
  chapterId: "",
  clusterId: "",
  projectId: "",
  status: "",
  riskOnly: false,
  delayedOnly: false,
  ownerActorId: "",
}

export interface PortfolioPlanningProject {
  project: Project
  entries: readonly PlanningEntry[]
  phases: readonly ProjectPhase[]
  milestones: readonly Milestone[]
  assignments: readonly ResourceAssignment[]
  rows: readonly PlanningRow[]
}

export interface PortfolioPlanningCluster {
  id: string
  title: string
  cluster?: Cluster
  projects: readonly PortfolioPlanningProject[]
}

export interface PortfolioPlanningChapter {
  chapter: Chapter
  clusters: readonly PortfolioPlanningCluster[]
}

export interface PortfolioPlanningSummary {
  totalProjects: number
  projectsWithPlanning: number
  projectsWithoutPlanning: number
  planningItemCount: number
  milestoneCount: number
  attentionItemCount: number
  earliestDate?: string
  latestDate?: string
  indicativeFte: number
  unscaledProjectCount: number
  sizeCounts: Readonly<Record<ProjectSize, number>>
  resourceConflictCount?: number
  delayedPhaseCount?: number
}

export function isPlanningEntryDelayed(
  entry: Pick<PlanningEntry, "plannedEndDate" | "status">,
  today: string,
): boolean {
  return (
    entry.plannedEndDate < today && !closedPlanningStatuses.has(entry.status)
  )
}

function assignmentFte(
  assignment: Pick<
    ResourceAssignment,
    "allocation" | "allocationMode" | "startDate" | "endDate"
  >,
): number {
  if (
    assignment.allocationMode === "fte" ||
    assignment.allocationMode === "indicative"
  )
    return assignment.allocation
  if (assignment.allocationMode === "hours") return assignment.allocation / 40
  const days = Math.max(
    1,
    Math.floor(
      (Date.parse(`${assignment.endDate}T00:00:00Z`) -
        Date.parse(`${assignment.startDate}T00:00:00Z`)) /
        86_400_000,
    ) + 1,
  )
  return assignment.allocation / (Math.max(1, days / 7) * 40)
}

function kindFor(entry: PlanningEntry): PlanningRow["kind"] {
  if (entry.kind === "Topic") return "topic"
  if (entry.isMilestone || entry.kind === "Milestone") return "milestone"
  return "custom"
}

function entryRow(
  state: NormalizedDomainState,
  entry: PlanningEntry,
  today: string,
  depth: PlanningRow["depth"] = 1,
): PlanningRow {
  const topic = entry.topicId
    ? state.indices.topicById.get(entry.topicId)
    : undefined
  const owner = topic?.ownerActorId
    ? state.indices.actorById.get(topic.ownerActorId)
    : undefined
  return {
    id: entry.id,
    title: entry.title,
    subtitle:
      entry.kind === "Topic"
        ? (topic?.code ?? "Topic")
        : entry.kind === "Milestone"
          ? "Mijlpaal"
          : "Vrij planningitem",
    depth,
    kind: kindFor(entry),
    projectId: entry.projectId,
    entry,
    ...(topic ? { topic } : {}),
    ...(owner ? { owner } : {}),
    ...(entry.startDate ? { startDate: entry.startDate } : {}),
    endDate: entry.plannedEndDate,
    progressPercent: entry.progressPercent ?? 0,
    status: entry.status,
    isMilestone: entry.isMilestone,
    delayed: isPlanningEntryDelayed(entry, today),
  }
}

function projectRow(
  project: Project,
  phases: readonly ProjectPhase[] = [],
): PlanningRow {
  const starts = phases.map((phase) => phase.startDate).sort()
  const ends = phases.map((phase) => phase.endDate).sort()
  const startDate = project.startDate ?? starts[0]
  const endDate = project.plannedEndDate ?? ends.at(-1)
  return {
    id: `project:${project.id}`,
    title: project.title,
    subtitle: `${project.code} · handmatige projectvoortgang`,
    depth: 0,
    kind: "project",
    projectId: project.id,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    progressPercent: project.progressPercent ?? 0,
    isMilestone: false,
    delayed: false,
  }
}

function phaseRow(
  state: NormalizedDomainState,
  phase: ProjectPhase,
  today: string,
  depth: PlanningRow["depth"] = 1,
): PlanningRow {
  const owner = phase.ownerActorId
    ? state.indices.actorById.get(phase.ownerActorId)
    : undefined
  return {
    id: phase.id,
    title: phase.name,
    subtitle: `${phase.intensity} · ${phase.progressPercent}%`,
    depth,
    kind: "phase",
    projectId: phase.projectId,
    phase,
    ...(owner ? { owner } : {}),
    startDate: phase.startDate,
    endDate: phase.endDate,
    progressPercent: phase.progressPercent,
    status: phase.status,
    isMilestone: false,
    delayed: phase.endDate < today && !closedPlanningStatuses.has(phase.status),
  }
}

function milestoneRow(
  state: NormalizedDomainState,
  milestone: Milestone,
  today: string,
  depth: PlanningRow["depth"] = 2,
): PlanningRow {
  const owner = milestone.ownerActorId
    ? state.indices.actorById.get(milestone.ownerActorId)
    : undefined
  return {
    id: milestone.id,
    title: milestone.name,
    subtitle: milestone.status,
    depth,
    kind: "milestone",
    projectId: milestone.projectId,
    milestone,
    ...(owner ? { owner } : {}),
    endDate: milestone.date,
    progressPercent: milestone.status === "Behaald" ? 100 : 0,
    isMilestone: true,
    delayed: milestone.date < today && milestone.status === "Gepland",
  }
}

function sourceRows(
  state: NormalizedDomainState,
  project: Project,
  depth: PlanningRow["depth"],
  today: string,
): PlanningRow[] {
  const topicIds = new Set(
    (state.indices.topicsByProject.get(project.id) ?? []).map(
      (topic) => topic.id,
    ),
  )
  const actions = [
    ...(state.indices.actionsByObject.get(`Project:${project.id}`) ?? []),
    ...[...topicIds].flatMap(
      (topicId) => state.indices.actionsByObject.get(`Topic:${topicId}`) ?? [],
    ),
  ]
  const updates = [
    ...(state.indices.updatesByObject.get(`Project:${project.id}`) ?? []),
    ...[...topicIds].flatMap(
      (topicId) => state.indices.updatesByObject.get(`Topic:${topicId}`) ?? [],
    ),
  ]
  const actionRows: PlanningRow[] = actions.flatMap((action) => {
    if (!action.audit.active || !action.deadline) return []
    const topic =
      action.objectType === "Topic"
        ? state.indices.topicById.get(action.objectId)
        : undefined
    return [
      {
        id: `action:${action.id}`,
        title: action.title,
        subtitle: `Actie${topic ? ` · ${topic.code}` : ""}`,
        depth,
        kind: "milestone",
        projectId: project.id,
        ...(topic ? { topic } : {}),
        actionId: action.id,
        endDate: action.deadline,
        progressPercent: action.status === "Afgerond" ? 100 : 0,
        isMilestone: true,
        delayed:
          action.deadline < today &&
          !["Afgerond", "Geannuleerd"].includes(action.status),
      },
    ]
  })
  const decisionRows: PlanningRow[] = updates.flatMap((update) => {
    if (!update.audit.active || update.type !== "Beslissing") return []
    const topic =
      update.objectType === "Topic"
        ? state.indices.topicById.get(update.objectId)
        : undefined
    return [
      {
        id: `decision:${update.id}`,
        title: update.text,
        subtitle: `Beslissing${topic ? ` · ${topic.code}` : ""}`,
        depth,
        kind: "milestone",
        projectId: project.id,
        ...(topic ? { topic } : {}),
        updateId: update.id,
        endDate: update.date,
        progressPercent: 100,
        isMilestone: true,
        delayed: false,
      },
    ]
  })
  return [...actionRows, ...decisionRows]
}

export function buildProjectPlanningModel(
  state: NormalizedDomainState,
  projectId: UUID,
  today: string,
): ProjectPlanningModel | undefined {
  const project = state.indices.projectById.get(projectId)
  if (!project) return undefined
  const entries = [...(state.indices.planningByProject.get(project.id) ?? [])]
    .filter((entry) => entry.audit.active)
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.plannedEndDate.localeCompare(right.plannedEndDate),
    )
  const entryIds = new Set(entries.map((entry) => entry.id))
  const dependencies = state.records.planningDependencies.filter(
    (dependency) =>
      dependency.audit.active &&
      entryIds.has(dependency.predecessorPlanningId) &&
      entryIds.has(dependency.successorPlanningId),
  )
  const phases = [...(state.indices.phasesByProject.get(project.id) ?? [])]
    .filter((phase) => phase.audit.active)
    .sort((left, right) => left.order - right.order)
  const milestones = [
    ...(state.indices.milestonesByProject.get(project.id) ?? []),
  ]
    .filter((milestone) => milestone.audit.active)
    .sort((left, right) => left.date.localeCompare(right.date))
  return {
    project,
    rows: [
      projectRow(project, phases),
      ...phases.flatMap((phase) => [
        phaseRow(state, phase, today),
        ...milestones
          .filter((milestone) => milestone.phaseId === phase.id)
          .map((milestone) => milestoneRow(state, milestone, today)),
      ]),
      ...milestones
        .filter((milestone) => !milestone.phaseId)
        .map((milestone) => milestoneRow(state, milestone, today, 1)),
      ...entries.map((entry) => entryRow(state, entry, today)),
      ...sourceRows(state, project, 1, today),
    ],
    entries,
    dependencies,
    phases,
    milestones,
    assignments: (
      state.indices.assignmentsByProject.get(project.id) ?? []
    ).filter((item) => item.audit.active),
  }
}

function projectMatchesFilters(
  state: NormalizedDomainState,
  project: Project,
  entries: readonly PlanningEntry[],
  phases: readonly ProjectPhase[],
  milestones: readonly Milestone[],
  filters: GlobalPlanningFilters,
  today: string,
): boolean {
  if (filters.chapterId && project.chapterId !== filters.chapterId) return false
  if (filters.clusterId && project.clusterId !== filters.clusterId) return false
  if (filters.projectId && project.id !== filters.projectId) return false
  if (
    filters.planningStatus &&
    project.planningStatus !== filters.planningStatus
  )
    return false
  if (
    filters.status &&
    !entries.some((entry) => entry.status === filters.status)
  )
    return false
  if (filters.riskOnly && !entries.some((entry) => entry.status === "Risico"))
    return false
  if (
    filters.delayedOnly &&
    !entries.some((entry) => isPlanningEntryDelayed(entry, today))
  )
    return false
  if (
    filters.ownerActorId &&
    !phases.some((phase) => phase.ownerActorId === filters.ownerActorId) &&
    !milestones.some(
      (milestone) => milestone.ownerActorId === filters.ownerActorId,
    ) &&
    !entries.some((entry) => {
      const topic = entry.topicId
        ? state.indices.topicById.get(entry.topicId)
        : undefined
      return topic?.ownerActorId === filters.ownerActorId
    })
  )
    return false
  if (
    filters.phase &&
    !phases.some((phase) =>
      phase.name
        .toLocaleLowerCase("nl")
        .includes(filters.phase!.toLocaleLowerCase("nl")),
    )
  )
    return false
  if (filters.resourceId || filters.roleId) {
    const resourceId = filters.resourceId || filters.roleId
    if (
      !(state.indices.assignmentsByProject.get(project.id) ?? []).some(
        (assignment) =>
          (assignment.resourceId ?? assignment.roleId) === resourceId,
      )
    )
      return false
  }
  return true
}

export function buildPortfolioPlanningModel(
  state: NormalizedDomainState,
  filters: GlobalPlanningFilters,
  today: string,
): readonly PortfolioPlanningChapter[] {
  const projects = state.records.projects.flatMap((project) => {
    const phases = (state.indices.phasesByProject.get(project.id) ?? []).filter(
      (phase) => phase.audit.active,
    )
    const milestones = (
      state.indices.milestonesByProject.get(project.id) ?? []
    ).filter((milestone) => milestone.audit.active)
    const entries = (state.indices.planningByProject.get(project.id) ?? [])
      .filter((entry) => entry.audit.active)
      .filter((entry) => !filters.status || entry.status === filters.status)
      .filter((entry) => !filters.riskOnly || entry.status === "Risico")
      .filter(
        (entry) => !filters.delayedOnly || isPlanningEntryDelayed(entry, today),
      )
      .filter((entry) => {
        if (!filters.ownerActorId) return true
        const topic = entry.topicId
          ? state.indices.topicById.get(entry.topicId)
          : undefined
        return topic?.ownerActorId === filters.ownerActorId
      })
    const allEntries = state.indices.planningByProject.get(project.id) ?? []
    if (
      !projectMatchesFilters(
        state,
        project,
        allEntries,
        phases,
        milestones,
        filters,
        today,
      )
    )
      return []
    const assignments = (
      state.indices.assignmentsByProject.get(project.id) ?? []
    ).filter((assignment) => assignment.audit.active)
    return [{ project, entries, phases, milestones, assignments }]
  })

  const byChapter = new Map<UUID, typeof projects>()
  for (const item of projects) {
    const group = byChapter.get(item.project.chapterId) ?? []
    group.push(item)
    byChapter.set(item.project.chapterId, group)
  }

  return [...byChapter.entries()]
    .flatMap(([chapterId, chapterProjects]) => {
      const chapter = state.indices.chapterById.get(chapterId)
      if (!chapter) return []
      const byCluster = new Map<string, typeof projects>()
      for (const item of chapterProjects) {
        const key = item.project.clusterId ?? "without-cluster"
        const group = byCluster.get(key) ?? []
        group.push(item)
        byCluster.set(key, group)
      }
      const clusters = [...byCluster.entries()]
        .map(([id, clusterProjects]) => {
          const cluster =
            id === "without-cluster"
              ? undefined
              : state.indices.clusterById.get(id as UUID)
          return {
            id,
            title: cluster?.title ?? "Zonder cluster",
            ...(cluster ? { cluster } : {}),
            projects: clusterProjects
              .sort((left, right) =>
                left.project.code.localeCompare(right.project.code, "nl"),
              )
              .map(({ project, entries, phases, milestones, assignments }) => ({
                project,
                entries,
                phases,
                milestones,
                assignments,
                rows: [
                  projectRow(project, phases),
                  ...phases
                    .sort((left, right) => left.order - right.order)
                    .flatMap((phase) => [
                      phaseRow(state, phase, today, 2),
                      ...milestones
                        .filter((milestone) => milestone.phaseId === phase.id)
                        .map((milestone) =>
                          milestoneRow(state, milestone, today, 3),
                        ),
                    ]),
                  ...milestones
                    .filter((milestone) => !milestone.phaseId)
                    .map((milestone) =>
                      milestoneRow(state, milestone, today, 2),
                    ),
                  ...entries.map((entry) => entryRow(state, entry, today, 2)),
                  ...sourceRows(state, project, 2, today),
                ],
              })),
          }
        })
        .sort((left, right) => {
          if (!left.cluster) return 1
          if (!right.cluster) return -1
          return left.cluster.order - right.cluster.order
        })
      return [{ chapter, clusters }]
    })
    .sort(
      (left, right) =>
        left.chapter.order - right.chapter.order ||
        left.chapter.title.localeCompare(right.chapter.title, "nl"),
    )
}

export function summarizePortfolioPlanning(
  model: readonly PortfolioPlanningChapter[],
  today: string,
): PortfolioPlanningSummary {
  let totalProjects = 0
  let projectsWithPlanning = 0
  let planningItemCount = 0
  let milestoneCount = 0
  let attentionItemCount = 0
  let indicativeFte = 0
  let unscaledProjectCount = 0
  const sizeCounts: Record<ProjectSize, number> = {
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
  }
  const dates: string[] = []

  for (const chapter of model) {
    for (const cluster of chapter.clusters) {
      for (const item of cluster.projects) {
        totalProjects += 1
        if (item.project.size) {
          sizeCounts[item.project.size] += 1
          // XS–XXL selects a profile; actual demand comes from assignments.
        } else unscaledProjectCount += 1
        indicativeFte += item.assignments.length
          ? item.assignments.reduce(
              (sum, assignment) => sum + assignmentFte(assignment),
              0,
            )
          : item.project.size
            ? projectSizeFte[item.project.size]
            : 0
        const hasProjectPlanning = Boolean(
          item.project.startDate || item.project.plannedEndDate,
        )
        if (hasProjectPlanning || item.entries.length || item.phases.length) {
          projectsWithPlanning += 1
        }
        if (item.project.startDate) dates.push(item.project.startDate)
        if (item.project.plannedEndDate) dates.push(item.project.plannedEndDate)

        planningItemCount += item.entries.length
        planningItemCount += item.phases.length
        milestoneCount += item.milestones.length
        for (const phase of item.phases) {
          dates.push(phase.startDate, phase.endDate)
          if (
            phase.status === "Risico" ||
            phase.status === "Vertraagd" ||
            (phase.endDate < today && !closedPlanningStatuses.has(phase.status))
          )
            attentionItemCount += 1
        }
        for (const milestone of item.milestones) {
          dates.push(milestone.date)
          if (
            milestone.status === "Gemist" ||
            (milestone.status === "Gepland" && milestone.date < today)
          )
            attentionItemCount += 1
        }
        for (const entry of item.entries) {
          if (entry.startDate) dates.push(entry.startDate)
          dates.push(entry.plannedEndDate)
          if (entry.isMilestone || entry.kind === "Milestone") {
            milestoneCount += 1
          }
          if (
            entry.status === "Risico" ||
            entry.status === "Vertraagd" ||
            isPlanningEntryDelayed(entry, today)
          ) {
            attentionItemCount += 1
          }
        }
      }
    }
  }

  dates.sort((left, right) => left.localeCompare(right))
  const earliestDate = dates[0]
  const latestDate = dates.at(-1)
  return {
    totalProjects,
    projectsWithPlanning,
    projectsWithoutPlanning: totalProjects - projectsWithPlanning,
    planningItemCount,
    milestoneCount,
    attentionItemCount,
    indicativeFte,
    unscaledProjectCount,
    sizeCounts,
    ...(earliestDate ? { earliestDate } : {}),
    ...(latestDate ? { latestDate } : {}),
  }
}

export function planningRiskProjectIds(
  state: NormalizedDomainState,
  today: string,
): ReadonlySet<UUID> {
  return new Set([
    ...state.records.planning
      .filter(
        (entry) =>
          entry.audit.active &&
          (entry.status === "Risico" ||
            entry.status === "Vertraagd" ||
            isPlanningEntryDelayed(entry, today)),
      )
      .map((entry) => entry.projectId),
    ...state.records.projectPhases
      .filter(
        (phase) =>
          phase.audit.active &&
          (phase.status === "Risico" ||
            phase.status === "Vertraagd" ||
            (phase.endDate < today &&
              !closedPlanningStatuses.has(phase.status))),
      )
      .map((phase) => phase.projectId),
    ...state.records.milestones
      .filter(
        (milestone) =>
          milestone.audit.active &&
          (milestone.status === "Gemist" ||
            (milestone.status === "Gepland" && milestone.date < today)),
      )
      .map((milestone) => milestone.projectId),
  ])
}

export interface CapacityBreakdownItem {
  assignment: ResourceAssignment
  project: Project
  phase?: ProjectPhase
  demandFte: number
}

export interface ResourceCapacityPeriod {
  id: string
  resource: Resource
  startDate: string
  endDate: string
  demandFte: number
  capacityFte: number
  loadPercent: number
  conflict: boolean
  breakdown: readonly CapacityBreakdownItem[]
}

function monthEnd(monthStart: string): string {
  const value = new Date(`${monthStart}T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + 1)
  value.setUTCDate(0)
  return value.toISOString().slice(0, 10)
}

export function buildResourceCapacity(
  state: NormalizedDomainState,
  range?: { startDate: string; endDate: string },
): readonly ResourceCapacityPeriod[] {
  const active = state.records.resourceAssignments.filter(
    (item) => item.audit.active,
  )
  const dates = active.flatMap((item) => [item.startDate, item.endDate]).sort()
  const start = range?.startDate ?? dates[0]
  const end = range?.endDate ?? dates.at(-1)
  if (!start || !end) return []
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`)
  const periods: { startDate: string; endDate: string }[] = []
  while (cursor.toISOString().slice(0, 10) <= end) {
    const startDate = cursor.toISOString().slice(0, 10)
    periods.push({ startDate, endDate: monthEnd(startDate) })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  const result: ResourceCapacityPeriod[] = []
  for (const resource of state.records.resources.filter(
    (item) => item.audit.active,
  )) {
    const assignments =
      state.indices.assignmentsByResource.get(resource.id) ?? []
    for (const period of periods) {
      const breakdown = assignments.flatMap(
        (assignment): CapacityBreakdownItem[] => {
          if (
            !assignment.audit.active ||
            assignment.endDate < period.startDate ||
            assignment.startDate > period.endDate
          )
            return []
          const project = state.indices.projectById.get(assignment.projectId)
          if (!project) return []
          const phase = assignment.phaseId
            ? state.indices.projectPhaseById.get(assignment.phaseId)
            : undefined
          const demandFte =
            assignmentFte(assignment) *
            (phase ? phaseIntensityFactors[phase.intensity] : 1)
          return [
            { assignment, project, ...(phase ? { phase } : {}), demandFte },
          ]
        },
      )
      const demandFte = breakdown.reduce((sum, item) => sum + item.demandFte, 0)
      const capacityFte = resource.projectAvailabilityFte
      const loadPercent =
        capacityFte > 0
          ? (demandFte / capacityFte) * 100
          : demandFte > 0
            ? Infinity
            : 0
      if (demandFte > 0 || range)
        result.push({
          id: `${resource.id}:${period.startDate}`,
          resource,
          ...period,
          demandFte,
          capacityFte,
          loadPercent,
          conflict: loadPercent > 100,
          breakdown,
        })
    }
  }
  return result
}

export interface PlanningAttentionSummary {
  upcomingMilestones: readonly Milestone[]
  delayedPhases: readonly ProjectPhase[]
  projectsWithoutPlanning: readonly Project[]
  resourceConflicts: readonly ResourceCapacityPeriod[]
  overallocatedResources: readonly Resource[]
  planningAttention: readonly Project[]
}

export function buildPlanningAttention(
  state: NormalizedDomainState,
  today: string,
): PlanningAttentionSummary {
  const horizon = new Date(`${today}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + 30)
  const horizonDate = horizon.toISOString().slice(0, 10)
  const upcomingMilestones = state.records.milestones
    .filter(
      (item) =>
        item.audit.active &&
        item.status === "Gepland" &&
        item.date >= today &&
        item.date <= horizonDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const delayedPhases = state.records.projectPhases
    .filter(
      (item) =>
        item.audit.active &&
        item.endDate < today &&
        !closedPlanningStatuses.has(item.status),
    )
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
  const projectsWithoutPlanning = state.records.projects.filter(
    (project) =>
      !(state.indices.phasesByProject.get(project.id) ?? []).some(
        (phase) => phase.audit.active,
      ) &&
      !project.startDate &&
      !project.plannedEndDate,
  )
  const resourceConflicts = buildResourceCapacity(state).filter(
    (item) => item.conflict,
  )
  const conflictIds = new Set(resourceConflicts.map((item) => item.resource.id))
  const overallocatedResources = state.records.resources.filter((resource) =>
    conflictIds.has(resource.id),
  )
  const attentionIds = new Set<UUID>([
    ...delayedPhases.map((phase) => phase.projectId),
    ...state.records.milestones
      .filter(
        (item) =>
          item.audit.active &&
          (item.status === "Gemist" ||
            (item.status === "Gepland" && item.date < today)),
      )
      .map((item) => item.projectId),
    ...resourceConflicts.flatMap((period) =>
      period.breakdown.map((item) => item.project.id),
    ),
  ])
  return {
    upcomingMilestones,
    delayedPhases,
    projectsWithoutPlanning,
    resourceConflicts,
    overallocatedResources,
    planningAttention: state.records.projects.filter((project) =>
      attentionIds.has(project.id),
    ),
  }
}
