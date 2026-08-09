import {
  buildBudgetLedgerSummary,
  budgetBusinessMetrics,
  type BudgetLedgerSummary,
  type BudgetRecord,
  type BudgetStatus,
  type BudgetType,
  type Chapter,
  type Cluster,
  type Project,
  type ProjectStatus,
  type Topic,
  type UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"

export type BudgetGrouping =
  "project" | "chapter" | "cluster" | "category" | "type"

export interface BudgetFilters {
  chapterId?: UUID
  clusterId?: UUID
  projectId?: UUID
  projectStatus?: ProjectStatus
  budgetStatus?: BudgetStatus
  category?: string
}

export const defaultBudgetFilters: BudgetFilters = {}

export interface ProjectBudgetModel {
  project: Project
  records: readonly BudgetRecord[]
  topics: readonly Topic[]
  summary: BudgetLedgerSummary
  metrics: ReturnType<typeof budgetBusinessMetrics>
}

export interface BudgetProjectRow {
  project: Project
  chapter?: Chapter
  cluster?: Cluster
  records: readonly BudgetRecord[]
  summary: BudgetLedgerSummary
}

export interface BudgetGroupRow {
  key: string
  label: string
  records: readonly BudgetRecord[]
  summary: BudgetLedgerSummary
}

export interface BudgetPortfolioModel {
  projectRows: readonly BudgetProjectRow[]
  groups: readonly BudgetGroupRow[]
  filteredRecords: readonly BudgetRecord[]
  portfolioSummary: BudgetLedgerSummary
  metrics: ReturnType<typeof budgetBusinessMetrics>
  projectsWithoutEstimateRecord: readonly Project[]
  categories: readonly string[]
}

function activeBudgetRecords(records: readonly BudgetRecord[]) {
  return records.filter((record) => record.audit.active)
}

export function buildProjectBudgetModel(
  state: NormalizedDomainState,
  projectId: UUID,
  topicId?: UUID,
): ProjectBudgetModel | undefined {
  const project = state.indices.projectById.get(projectId)
  if (!project) return undefined
  const projectRecords = activeBudgetRecords(
    state.indices.budgetByProject.get(project.id) ?? [],
  )
  const records = topicId
    ? projectRecords.filter((record) => record.topicId === topicId)
    : projectRecords
  return {
    project,
    records: [...records].sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        left.description.localeCompare(right.description, "nl"),
    ),
    topics: [...(state.indices.topicsByProject.get(project.id) ?? [])]
      .filter((topic) => topic.audit.active)
      .sort((left, right) => left.order - right.order),
    summary: buildBudgetLedgerSummary(records),
    metrics: budgetBusinessMetrics(),
  }
}

function projectMatchesFilters(
  project: Project,
  filters: BudgetFilters,
): boolean {
  if (filters.chapterId && project.chapterId !== filters.chapterId) return false
  if (filters.clusterId && project.clusterId !== filters.clusterId) return false
  if (filters.projectId && project.id !== filters.projectId) return false
  if (filters.projectStatus && project.status !== filters.projectStatus) {
    return false
  }
  return true
}

function recordMatchesFilters(
  record: BudgetRecord,
  filters: BudgetFilters,
): boolean {
  if (filters.budgetStatus && record.status !== filters.budgetStatus) {
    return false
  }
  if (filters.category && record.category !== filters.category) return false
  return true
}

function groupIdentity(
  state: NormalizedDomainState,
  grouping: BudgetGrouping,
  record: BudgetRecord,
): { key: string; label: string } {
  const project = state.indices.projectById.get(record.projectId)
  if (grouping === "project") {
    return {
      key: record.projectId,
      label: project
        ? `${project.code} · ${project.title}`
        : "Onbekend project",
    }
  }
  if (grouping === "chapter") {
    const chapter = project
      ? state.indices.chapterById.get(project.chapterId)
      : undefined
    return {
      key: chapter?.id ?? "unknown-chapter",
      label: chapter?.title ?? "Onbekend hoofdstuk",
    }
  }
  if (grouping === "cluster") {
    const cluster = project?.clusterId
      ? state.indices.clusterById.get(project.clusterId)
      : undefined
    return {
      key: cluster?.id ?? "without-cluster",
      label: cluster?.title ?? "Zonder cluster",
    }
  }
  if (grouping === "category") {
    return { key: record.category, label: record.category }
  }
  return { key: record.type, label: record.type }
}

function buildGroups(
  state: NormalizedDomainState,
  records: readonly BudgetRecord[],
  grouping: BudgetGrouping,
): readonly BudgetGroupRow[] {
  const grouped = new Map<string, { label: string; records: BudgetRecord[] }>()
  for (const record of records) {
    const identity = groupIdentity(state, grouping, record)
    const group = grouped.get(identity.key) ?? {
      label: identity.label,
      records: [],
    }
    group.records.push(record)
    grouped.set(identity.key, group)
  }
  return [...grouped.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      records: group.records,
      summary: buildBudgetLedgerSummary(group.records),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "nl"))
}

export function buildBudgetPortfolioModel(
  state: NormalizedDomainState,
  filters: BudgetFilters = defaultBudgetFilters,
  grouping: BudgetGrouping = "project",
): BudgetPortfolioModel {
  const projects = state.records.projects.filter(
    (project) =>
      project.audit.active && projectMatchesFilters(project, filters),
  )
  const projectIds = new Set(projects.map((project) => project.id))
  const filteredRecords = activeBudgetRecords(state.records.budgets).filter(
    (record) =>
      projectIds.has(record.projectId) && recordMatchesFilters(record, filters),
  )
  const recordsByProject = new Map<UUID, BudgetRecord[]>()
  for (const record of filteredRecords) {
    const projectRecords = recordsByProject.get(record.projectId) ?? []
    projectRecords.push(record)
    recordsByProject.set(record.projectId, projectRecords)
  }
  const projectRows = projects
    .map((project) => {
      const records = recordsByProject.get(project.id) ?? []
      const chapter = state.indices.chapterById.get(project.chapterId)
      const cluster = project.clusterId
        ? state.indices.clusterById.get(project.clusterId)
        : undefined
      return {
        project,
        ...(chapter ? { chapter } : {}),
        ...(cluster ? { cluster } : {}),
        records,
        summary: buildBudgetLedgerSummary(records),
      }
    })
    .sort((left, right) =>
      left.project.code.localeCompare(right.project.code, "nl"),
    )
  const projectsWithoutEstimateRecord = projectRows
    .filter((row) => !row.summary.hasNonCancelledEstimateRecord)
    .map((row) => row.project)
  const categories = [
    ...new Set(
      state.records.budgets
        .filter((record) => record.audit.active)
        .map((record) => record.category),
    ),
  ].sort((left, right) => left.localeCompare(right, "nl"))

  return {
    projectRows,
    groups: buildGroups(state, filteredRecords, grouping),
    filteredRecords,
    portfolioSummary: buildBudgetLedgerSummary(filteredRecords),
    metrics: budgetBusinessMetrics(),
    projectsWithoutEstimateRecord,
    categories,
  }
}

export function budgetTypeAmount(
  summary: BudgetLedgerSummary,
  type: BudgetType,
): number {
  return summary.typeTotals.get(type)?.amountCents ?? 0
}
