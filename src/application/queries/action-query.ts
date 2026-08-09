import type {
  Action,
  ActionStatus,
  Actor,
  Cluster,
  Priority,
  Project,
  Topic,
  UUID,
} from "../../domain"
import type { NormalizedDomainState } from "../services"

export type ActionDateScope =
  "" | "overdue" | "thisWeek" | "next14" | "noDeadline" | "waitingDecision"

export interface ActionFilters {
  search: string
  ownerActorId: string
  projectId: string
  clusterId: string
  status: "" | ActionStatus
  priority: "" | Priority
  dateScope: ActionDateScope
}

export const defaultActionFilters: ActionFilters = {
  search: "",
  ownerActorId: "",
  projectId: "",
  clusterId: "",
  status: "",
  priority: "",
  dateScope: "",
}

export interface ActionListItem {
  action: Action
  owner?: Actor
  project?: Project
  cluster?: Cluster
  topic?: Topic
  contextLabel: string
  projectLabel: string
}

export interface ActionOwnerGroup {
  owner?: Actor
  ownerActorId: UUID
  actions: readonly ActionListItem[]
}

export interface ProjectActionSummary {
  all: readonly ActionListItem[]
  open: readonly ActionListItem[]
  overdue: readonly ActionListItem[]
  next14Days: readonly ActionListItem[]
  waitingDecision: readonly ActionListItem[]
  recentlyCompleted: readonly ActionListItem[]
}

const closedStatuses = new Set<ActionStatus>(["Afgerond", "Geannuleerd"])

export function isActionOpen(action: Action): boolean {
  return action.audit.active && !closedStatuses.has(action.status)
}

export function isActionOverdue(action: Action, today: string): boolean {
  return Boolean(
    isActionOpen(action) && action.deadline && action.deadline < today,
  )
}

export function addLocalDateDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function endOfWeek(today: string): string {
  const date = new Date(`${today}T00:00:00Z`)
  const day = date.getUTCDay() || 7
  return addLocalDateDays(today, 7 - day)
}

function contextRelations(
  state: NormalizedDomainState,
  action: Action,
): Omit<ActionListItem, "action" | "owner"> {
  let project: Project | undefined
  let cluster: Cluster | undefined
  let topic: Topic | undefined
  let contextLabel = "Onbekende context"

  if (action.objectType === "Project") {
    project = state.indices.projectById.get(action.objectId)
    cluster = project?.clusterId
      ? state.indices.clusterById.get(project.clusterId)
      : undefined
    contextLabel = project?.title ?? "Onbekend project"
  } else if (action.objectType === "Cluster") {
    cluster = state.indices.clusterById.get(action.objectId)
    contextLabel = cluster?.title ?? "Onbekende cluster"
  } else if (action.objectType === "Topic") {
    topic = state.indices.topicById.get(action.objectId)
    project = topic?.projectId
      ? state.indices.projectById.get(topic.projectId)
      : undefined
    cluster = topic?.clusterId
      ? state.indices.clusterById.get(topic.clusterId)
      : project?.clusterId
        ? state.indices.clusterById.get(project.clusterId)
        : undefined
    contextLabel = topic?.title ?? "Onbekend topic"
  } else if (action.objectType === "Meeting") {
    const meeting = state.indices.meetingById.get(action.objectId)
    contextLabel = meeting?.title ?? "Onbekend overleg"
    if (meeting?.scopeType === "Project" && meeting.scopeId) {
      project = state.indices.projectById.get(meeting.scopeId)
    }
    if (meeting?.scopeType === "Cluster" && meeting.scopeId) {
      cluster = state.indices.clusterById.get(meeting.scopeId)
    }
  }

  return {
    ...(project ? { project } : {}),
    ...(cluster ? { cluster } : {}),
    ...(topic ? { topic } : {}),
    contextLabel,
    projectLabel: project ? `${project.code} · ${project.title}` : "—",
  }
}

export function buildActionListItems(
  state: NormalizedDomainState,
  actions: readonly Action[] = state.records.actions,
): readonly ActionListItem[] {
  return actions
    .filter((action) => action.audit.active)
    .map((action) => {
      const owner = state.indices.actorById.get(action.ownerActorId)
      return {
        action,
        ...(owner ? { owner } : {}),
        ...contextRelations(state, action),
      }
    })
    .sort(
      (left, right) =>
        Number(isActionOpen(right.action)) -
          Number(isActionOpen(left.action)) ||
        (left.action.deadline ?? "9999-12-31").localeCompare(
          right.action.deadline ?? "9999-12-31",
        ) ||
        left.action.title.localeCompare(right.action.title, "nl"),
    )
}

export function filterActionListItems(
  items: readonly ActionListItem[],
  filters: ActionFilters,
  today: string,
): readonly ActionListItem[] {
  const search = filters.search.trim().toLocaleLowerCase("nl")
  const weekEnd = endOfWeek(today)
  const next14 = addLocalDateDays(today, 14)

  return items.filter((item) => {
    const { action } = item
    if (filters.ownerActorId && action.ownerActorId !== filters.ownerActorId)
      return false
    if (filters.projectId && item.project?.id !== filters.projectId)
      return false
    if (filters.clusterId && item.cluster?.id !== filters.clusterId)
      return false
    if (filters.status && action.status !== filters.status) return false
    if (filters.priority && action.priority !== filters.priority) return false

    if (filters.dateScope === "overdue" && !isActionOverdue(action, today))
      return false
    if (
      filters.dateScope === "thisWeek" &&
      (!isActionOpen(action) ||
        !action.deadline ||
        action.deadline < today ||
        action.deadline > weekEnd)
    )
      return false
    if (
      filters.dateScope === "next14" &&
      (!isActionOpen(action) ||
        !action.deadline ||
        action.deadline < today ||
        action.deadline > next14)
    )
      return false
    if (filters.dateScope === "noDeadline" && action.deadline) return false
    if (
      filters.dateScope === "waitingDecision" &&
      action.status !== "Wacht op beslissing"
    )
      return false

    if (!search) return true
    return [
      action.code,
      action.title,
      action.description,
      item.projectLabel,
      item.contextLabel,
      item.owner?.displayName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("nl")
      .includes(search)
  })
}

export function groupActionListItemsByOwner(
  items: readonly ActionListItem[],
): readonly ActionOwnerGroup[] {
  const grouped = new Map<UUID, ActionListItem[]>()
  for (const item of items) {
    const group = grouped.get(item.action.ownerActorId) ?? []
    group.push(item)
    grouped.set(item.action.ownerActorId, group)
  }
  return [...grouped.entries()]
    .map(([ownerActorId, actions]) => ({
      ownerActorId,
      ...(actions[0]?.owner ? { owner: actions[0].owner } : {}),
      actions,
    }))
    .sort((left, right) =>
      (left.owner?.displayName ?? "Onbekende actor").localeCompare(
        right.owner?.displayName ?? "Onbekende actor",
        "nl",
      ),
    )
}

export function buildProjectActionSummary(
  state: NormalizedDomainState,
  projectId: UUID,
  today: string,
): ProjectActionSummary {
  const all = buildActionListItems(
    state,
    state.indices.actionsByProject.get(projectId) ?? [],
  )
  const open = all.filter((item) => isActionOpen(item.action))
  const next14 = addLocalDateDays(today, 14)
  return {
    all,
    open,
    overdue: open.filter((item) => isActionOverdue(item.action, today)),
    next14Days: open.filter(
      (item) =>
        Boolean(item.action.deadline) &&
        item.action.deadline! >= today &&
        item.action.deadline! <= next14,
    ),
    waitingDecision: open.filter(
      (item) => item.action.status === "Wacht op beslissing",
    ),
    recentlyCompleted: all
      .filter((item) => item.action.status === "Afgerond")
      .sort((left, right) =>
        (right.action.completedAt ?? "").localeCompare(
          left.action.completedAt ?? "",
        ),
      )
      .slice(0, 5),
  }
}
