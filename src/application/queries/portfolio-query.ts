import type {
  Actor,
  Chapter,
  Cluster,
  Project,
  ProjectStatus,
  UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"
import { isPlanningEntryDelayed } from "./planning-query"

export type PortfolioScope = "open" | "closed" | "all"

export interface PortfolioFilters {
  search: string
  scope: PortfolioScope
  chapterId: string
  clusterId: string
  status: string
  phase: string
  site: string
  location: string
  department: string
  coordinatorActorId: string
}

export interface PortfolioProjectRow {
  project: Project
  chapter: Chapter
  cluster?: Cluster
  coordinator?: Actor
  openTopicCount: number
  criticalTopicCount: number
  openActionCount: number
  overdueActionCount: number
  planningAttentionCount: number
}

export interface PortfolioClusterGroup {
  id: string
  title: string
  cluster?: Cluster
  projects: readonly PortfolioProjectRow[]
}

export interface PortfolioChapterGroup {
  chapter: Chapter
  clusters: readonly PortfolioClusterGroup[]
}

export interface PortfolioFilterOptions {
  chapters: readonly Chapter[]
  clusters: readonly Cluster[]
  statuses: readonly string[]
  phases: readonly string[]
  sites: readonly string[]
  locations: readonly string[]
  departments: readonly string[]
  coordinators: readonly Actor[]
}

export const defaultPortfolioFilters: PortfolioFilters = {
  search: "",
  scope: "open",
  chapterId: "",
  clusterId: "",
  status: "",
  phase: "",
  site: "",
  location: "",
  department: "",
  coordinatorActorId: "",
}

const closedProjectStatuses = new Set<ProjectStatus>([
  "Afgesloten",
  "Geannuleerd",
])
const closedActionStatuses = new Set(["Afgerond", "Geannuleerd"])

function increment(map: Map<UUID, number>, id: UUID): void {
  map.set(id, (map.get(id) ?? 0) + 1)
}

function sortedUnique(values: readonly (string | undefined)[]): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort((left, right) => left.localeCompare(right, "nl"))
}

export function isProjectClosed(status: ProjectStatus): boolean {
  return closedProjectStatuses.has(status)
}

export function buildPortfolioRows(
  state: NormalizedDomainState,
  today: string,
): readonly PortfolioProjectRow[] {
  const openTopics = new Map<UUID, number>()
  const criticalTopics = new Map<UUID, number>()
  const openActions = new Map<UUID, number>()
  const overdueActions = new Map<UUID, number>()
  const planningAttention = new Map<UUID, number>()

  for (const topic of state.records.topics) {
    if (!topic.projectId) continue
    if (topic.status !== "Open") continue
    increment(openTopics, topic.projectId)
    if (topic.priority === "Kritiek") increment(criticalTopics, topic.projectId)
  }

  for (const project of state.records.projects) {
    for (const action of state.indices.actionsByProject.get(project.id) ?? []) {
      if (closedActionStatuses.has(action.status)) continue
      increment(openActions, project.id)
      if (action.deadline && action.deadline < today) {
        increment(overdueActions, project.id)
      }
    }
  }

  for (const entry of state.records.planning) {
    if (
      entry.status === "Risico" ||
      entry.status === "Vertraagd" ||
      isPlanningEntryDelayed(entry, today)
    ) {
      increment(planningAttention, entry.projectId)
    }
  }

  return state.records.projects.flatMap((project) => {
    const chapter = state.indices.chapterById.get(project.chapterId)
    if (!chapter) return []
    const cluster = project.clusterId
      ? state.indices.clusterById.get(project.clusterId)
      : undefined
    const coordinator = project.coordinatorActorId
      ? state.indices.actorById.get(project.coordinatorActorId)
      : undefined
    return [
      {
        project,
        chapter,
        ...(cluster ? { cluster } : {}),
        ...(coordinator ? { coordinator } : {}),
        openTopicCount: openTopics.get(project.id) ?? 0,
        criticalTopicCount: criticalTopics.get(project.id) ?? 0,
        openActionCount: openActions.get(project.id) ?? 0,
        overdueActionCount: overdueActions.get(project.id) ?? 0,
        planningAttentionCount: planningAttention.get(project.id) ?? 0,
      },
    ]
  })
}

function normalizedSearchValue(row: PortfolioProjectRow): string {
  const project = row.project
  return [
    project.code,
    project.title,
    project.description,
    project.phase,
    project.site,
    project.location,
    project.department,
    row.chapter.title,
    row.cluster?.title,
    row.coordinator?.displayName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("nl")
}

export function filterPortfolioRows(
  rows: readonly PortfolioProjectRow[],
  filters: PortfolioFilters,
): readonly PortfolioProjectRow[] {
  const search = filters.search.trim().toLocaleLowerCase("nl")
  return rows.filter((row) => {
    const project = row.project
    if (filters.scope === "open" && isProjectClosed(project.status))
      return false
    if (filters.scope === "closed" && !isProjectClosed(project.status))
      return false
    if (filters.chapterId && project.chapterId !== filters.chapterId)
      return false
    if (filters.clusterId === "without-cluster" && project.clusterId)
      return false
    if (
      filters.clusterId &&
      filters.clusterId !== "without-cluster" &&
      project.clusterId !== filters.clusterId
    )
      return false
    if (filters.status && project.status !== filters.status) return false
    if (filters.phase && project.phase !== filters.phase) return false
    if (filters.site && project.site !== filters.site) return false
    if (filters.location && project.location !== filters.location) return false
    if (filters.department && project.department !== filters.department)
      return false
    if (
      filters.coordinatorActorId &&
      project.coordinatorActorId !== filters.coordinatorActorId
    )
      return false
    return !search || normalizedSearchValue(row).includes(search)
  })
}

export function groupPortfolioRows(
  rows: readonly PortfolioProjectRow[],
): readonly PortfolioChapterGroup[] {
  const chapters = new Map<UUID, PortfolioProjectRow[]>()
  for (const row of rows) {
    const group = chapters.get(row.chapter.id) ?? []
    group.push(row)
    chapters.set(row.chapter.id, group)
  }

  return [...chapters.values()]
    .sort(
      (left, right) =>
        left[0]!.chapter.order - right[0]!.chapter.order ||
        left[0]!.chapter.title.localeCompare(right[0]!.chapter.title, "nl"),
    )
    .map((chapterRows) => {
      const clusters = new Map<string, PortfolioProjectRow[]>()
      for (const row of chapterRows) {
        const key = row.cluster?.id ?? "without-cluster"
        const group = clusters.get(key) ?? []
        group.push(row)
        clusters.set(key, group)
      }
      return {
        chapter: chapterRows[0]!.chapter,
        clusters: [...clusters.entries()]
          .map(([id, projectRows]) => ({
            id,
            title: projectRows[0]!.cluster?.title ?? "Zonder cluster",
            ...(projectRows[0]!.cluster
              ? { cluster: projectRows[0]!.cluster }
              : {}),
            projects: [...projectRows].sort((left, right) =>
              left.project.code.localeCompare(right.project.code, "nl"),
            ),
          }))
          .sort((left, right) => {
            if (!left.cluster) return 1
            if (!right.cluster) return -1
            return (
              left.cluster.order - right.cluster.order ||
              left.title.localeCompare(right.title, "nl")
            )
          }),
      }
    })
}

export function getPortfolioFilterOptions(
  rows: readonly PortfolioProjectRow[],
): PortfolioFilterOptions {
  const chapterMap = new Map(rows.map((row) => [row.chapter.id, row.chapter]))
  const clusterMap = new Map(
    rows.flatMap((row) => (row.cluster ? [[row.cluster.id, row.cluster]] : [])),
  )
  const coordinatorMap = new Map(
    rows.flatMap((row) =>
      row.coordinator ? [[row.coordinator.id, row.coordinator]] : [],
    ),
  )
  return {
    chapters: [...chapterMap.values()].sort(
      (left, right) => left.order - right.order,
    ),
    clusters: [...clusterMap.values()].sort(
      (left, right) => left.order - right.order,
    ),
    statuses: sortedUnique(rows.map((row) => row.project.status)),
    phases: sortedUnique(rows.map((row) => row.project.phase)),
    sites: sortedUnique(rows.map((row) => row.project.site)),
    locations: sortedUnique(rows.map((row) => row.project.location)),
    departments: sortedUnique(rows.map((row) => row.project.department)),
    coordinators: [...coordinatorMap.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl"),
    ),
  }
}
