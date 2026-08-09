import type {
  Actor,
  Chapter,
  Cluster,
  PlanningDependency,
  PlanningEntry,
  PlanningStatus,
  Project,
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
  depth: 0 | 1 | 2
  kind: "project" | "topic" | "milestone" | "custom"
  projectId: UUID
  entry?: PlanningEntry
  topic?: Topic
  owner?: Actor
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
}

export interface GlobalPlanningFilters {
  chapterId: string
  clusterId: string
  projectId: string
  status: "" | PlanningStatus
  riskOnly: boolean
  delayedOnly: boolean
  ownerActorId: string
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

export function isPlanningEntryDelayed(
  entry: Pick<PlanningEntry, "plannedEndDate" | "status">,
  today: string,
): boolean {
  return (
    entry.plannedEndDate < today && !closedPlanningStatuses.has(entry.status)
  )
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

function projectRow(project: Project): PlanningRow {
  return {
    id: `project:${project.id}`,
    title: project.title,
    subtitle: `${project.code} · handmatige projectvoortgang`,
    depth: 0,
    kind: "project",
    projectId: project.id,
    ...(project.startDate ? { startDate: project.startDate } : {}),
    ...(project.plannedEndDate ? { endDate: project.plannedEndDate } : {}),
    progressPercent: project.progressPercent ?? 0,
    isMilestone: false,
    delayed: false,
  }
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
  return {
    project,
    rows: [
      projectRow(project),
      ...entries.map((entry) => entryRow(state, entry, today)),
    ],
    entries,
    dependencies,
  }
}

function projectMatchesFilters(
  state: NormalizedDomainState,
  project: Project,
  entries: readonly PlanningEntry[],
  filters: GlobalPlanningFilters,
  today: string,
): boolean {
  if (filters.chapterId && project.chapterId !== filters.chapterId) return false
  if (filters.clusterId && project.clusterId !== filters.clusterId) return false
  if (filters.projectId && project.id !== filters.projectId) return false
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
    !entries.some((entry) => {
      const topic = entry.topicId
        ? state.indices.topicById.get(entry.topicId)
        : undefined
      return topic?.ownerActorId === filters.ownerActorId
    })
  )
    return false
  return true
}

export function buildPortfolioPlanningModel(
  state: NormalizedDomainState,
  filters: GlobalPlanningFilters,
  today: string,
): readonly PortfolioPlanningChapter[] {
  const projects = state.records.projects.flatMap((project) => {
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
    if (!projectMatchesFilters(state, project, allEntries, filters, today))
      return []
    return [{ project, entries }]
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
              .map(({ project, entries }) => ({
                project,
                entries,
                rows: [
                  projectRow(project),
                  ...entries.map((entry) => entryRow(state, entry, today, 2)),
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

export function planningRiskProjectIds(
  state: NormalizedDomainState,
  today: string,
): ReadonlySet<UUID> {
  return new Set(
    state.records.planning
      .filter(
        (entry) =>
          entry.audit.active &&
          (entry.status === "Risico" ||
            entry.status === "Vertraagd" ||
            isPlanningEntryDelayed(entry, today)),
      )
      .map((entry) => entry.projectId),
  )
}
